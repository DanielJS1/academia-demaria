import { createClient } from "@supabase/supabase-js";
import { isAllowedCompanyEmail, normalizeEmail, pendingStudentProfile } from "./registration-security";
import { DEPARTMENTS } from "./departments";
import { courseXp } from "./rewards";
import { commandSchema, mergeWatched } from "./pilot-contract";
import { courseSchema, articleSchema, vimeoEmbed, safeImage, type AcademyState, type Course, type Article } from "./model";
export class ApiError extends Error { constructor(message:string,public status=400){super(message);} }
export function database(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)throw new ApiError("O Supabase ainda não foi configurado no servidor.",503);
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
export type Profile={id:string;name:string;email:string;department:string;manager_id:string|null;role:"admin"|"manager"|"student";status:"active"|"pending"|"inactive"};
export async function authenticate(request:Request){
 const token=request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
 if(!token)throw new ApiError("Entre na sua conta para continuar.",401);
 const db=database();const {data,error}=await db.auth.getUser(token);
 if(error||!data.user)throw new ApiError("Sua sessão expirou. Entre novamente.",401);
 if(!data.user.email||!isAllowedCompanyEmail(data.user.email))throw new ApiError("Este e-mail não pertence a um domínio autorizado.",403);
 let profile=await db.from("academy_profiles").select("*").eq("id",data.user.id).maybeSingle();
 let currentProfile: Profile | null = (profile.data as Profile) ?? null;
 if(!currentProfile){
  const name=(data.user.user_metadata?.name as string)||data.user.email?.split("@")[0]||"Colaborador";
  const {data:created}=await db.from("academy_profiles").insert(pendingStudentProfile(data.user.id,name,data.user.email)).select().single();
  currentProfile=(created as Profile)??null;
 }
 if(!currentProfile||currentProfile.status!=="active"){
  if(currentProfile?.status==="inactive")throw new ApiError("Seu acesso está inativo ou o cadastro foi reprovado. Entre em contato com o administrador.",403);
  throw new ApiError("Seu cadastro foi realizado com sucesso e está aguardando liberação do administrador. Fale com Daniel para ativar seu acesso.",403);
 }
 return {db,me:currentProfile};
}
function ensure(result:{error:unknown}){if(result.error)throw new ApiError("Não foi possível consultar o banco. Confira a configuração ou tente novamente.",503);}
export async function readAcademy(db:ReturnType<typeof database>,me:Profile){
 async function all(table:string,columns="*",field?:string,value?:string){
  const rows:Record<string,any>[]=[];
  for(let offset=0;;offset+=1000){let query=db.from(table).select(columns).range(offset,offset+999);query=table==="academy_progress"?query.order("user_id").order("course_id").order("version").order("lesson_id"):query.order("id");if(field)query=query.eq(field,value!);const result=await query;ensure(result);const page=result.data??[];rows.push(...page as unknown as Record<string,any>[]);if(page.length<1000)break;}
  return {data:rows,error:null};
 }
 const results=await Promise.all([
  all("academy_resources"),all("academy_profiles"),
  db.from("academy_settings").select("*").single(),
  all("academy_progress","user_id,course_id,version,lesson_id,done"),
  all("academy_attempts","*",me.role==="admin"?undefined:"user_id",me.id),
  all("academy_xp"),db.from("academy_preferences").select("*").eq("user_id",me.id).maybeSingle(),
 ]);
 results.forEach(ensure);
 const [resources,profiles,settings,progress,attempts,xp,preferences]=results;
 const courses:Course[]=(resources.data??[]).filter(r=>r.kind==="course"&&r.published).map(r=>({...r.published,xp:courseXp(r.published)}));
 const visibleCourses=courses.map(course=>me.role==="admin"?course:{...course,questions:course.questions.map(question=>({...question,correct:""}))});
 const completion:Record<string,string[]>={};
 for(const row of progress.data??[])if(row.user_id===me.id&&row.done&&courses.some(c=>c.id===row.course_id&&c.version===row.version))(completion[row.course_id]??=[]).push(row.lesson_id);
 const season=new Date().toLocaleDateString("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric"});
 const people=(profiles.data??[]).filter(p=>p.status!=="inactive"||me.role==="admin"||p.id===me.id).map(p=>{
  const report=me.role==="admin"||p.id===me.id||(me.role==="manager"&&p.manager_id===me.id);
  const total=courses.reduce((n,c)=>n+c.lessons.filter(l=>l.type!=="quiz").length,0);
  const done=(progress.data??[]).filter(r=>r.user_id===p.id&&r.done&&courses.some(c=>c.id===r.course_id&&c.version===r.version&&c.lessons.some(l=>l.id===r.lesson_id&&l.type!=="quiz"))).length;
  return {id:p.id,name:p.name,email:report?p.email:"",department:p.department,managerId:report?(p.manager_id??""):"",role:p.role,status:p.status,xp:(xp.data??[]).filter(x=>x.user_id===p.id&&x.season===season).reduce((n,x)=>n+x.amount,0),progress:report&&total?Math.round(done/total*100):0};
 });
 const state:AcademyState={schema:1,courses:visibleCourses,courseDrafts:me.role==="admin"?(resources.data??[]).filter(r=>r.kind==="course"&&r.draft).map(r=>r.draft):[],articles:(resources.data??[]).filter(r=>r.kind==="article"&&r.published).map(r=>r.published as Article),articleDrafts:me.role==="admin"?(resources.data??[]).filter(r=>r.kind==="article"&&r.draft).map(r=>r.draft):[],people,departments:settings.data.departments,products:settings.data.products,completed:completion,bookmarks:preferences.data?.bookmarks??[],readNotices:preferences.data?.read_notices??[],notifications:[],
  attempts:(attempts.data??[]).sort((a,b)=>a.submitted_at.localeCompare(b.submitted_at)).map(a=>({id:a.id,userId:a.user_id,courseId:a.course_id,courseTitle:a.snapshot.title,courseVersion:a.version,questions:a.snapshot.questions.map((q:Course["questions"][number])=>me.role==="admin"?q:{...q,correct:""}),answers:a.answers,status:a.status,feedback:a.feedback,score:a.score,passingScore:a.snapshot.passingScore,xp:a.snapshot.xp,submittedAt:a.submitted_at,retryPolicy:a.snapshot.retryPolicy,retryAllowed:a.retry_allowed,correctTextIds:a.correct_text_ids??[]})),
  xpEvents:(xp.data??[]).filter(x=>x.user_id===me.id).map(x=>({id:x.id,amount:x.amount,season:x.season,label:x.label}))};
 return {state,me:{id:me.id,name:me.name,email:me.email,role:me.role}};
}
export async function executeCommand(db:ReturnType<typeof database>,me:Profile,input:unknown){
 const parsed=commandSchema.safeParse(input);if(!parsed.success)throw new ApiError("Revise os campos enviados. Há valores inválidos.");
 const command=parsed.data;
 if(command.type==="delete-user"||command.type==="reject-user"){
  if(me.role!=="admin")throw new ApiError("Somente administradores podem executar esta ação.",403);
  if(command.id===me.id)throw new ApiError("Você não pode excluir ou reprovar sua própria conta.");
  if(command.type==="reject-user"){
   const {error}=await db.rpc("academy_reject_user",{actor:me.id,target:command.id});
   if(error)throw new ApiError(error.message);
  }else{
   const {error}=await db.auth.admin.deleteUser(command.id);
   if(error)throw new ApiError("Não foi possível excluir a conta. Confira se a migração do banco foi aplicada.",503);
   const audit=await db.from("academy_audit").insert({actor:me.id,action:"delete-user",resource:command.id});
   if(audit.error)console.error("User deletion audit failed",audit.error.code);
  }
  return;
 }
 if(["save-resource","review","unlock","profile","settings","invite"].includes(command.type)&&me.role!=="admin")throw new ApiError("Somente administradores podem executar esta ação.",403);
 if(command.type==="save-resource"){
  const body=command.kind==="course"?courseSchema.parse(command.data):articleSchema.parse(command.data);
  if(command.kind==="course"){
   const course=body as Course;
   if(!safeImage(course.banner)||course.lessons.some(l=>l.videoUrl&&!vimeoEmbed(l.videoUrl)))throw new ApiError("Use banner HTTPS e vídeos válidos do Vimeo.");
   if(new Set(course.lessons.map(l=>l.id)).size!==course.lessons.length||new Set(course.questions.map(q=>q.id)).size!==course.questions.length)throw new ApiError("Atividades ou questões duplicadas.");
   if(command.publish){
    if(!course.lessons.some(l=>l.type!=="quiz"))throw new ApiError("Adicione ao menos uma aula antes de publicar.");
    if(course.lessons.some(l=>l.type==="quiz")!==Boolean(course.questions.length))throw new ApiError("Para incluir avaliação, adicione a atividade de avaliação e suas perguntas; para publicar sem avaliação, remova ambas.");
    if(course.lessons.some(l=>!l.module.trim()||(l.type==="video"&&!vimeoEmbed(l.videoUrl))||(l.type==="reading"&&!l.content.trim())))throw new ApiError("Preencha os módulos, leituras e links Vimeo antes de publicar.");
    if(course.questions.some(q=>q.type==="choice"&&(q.options.length<2||new Set(q.options).size!==q.options.length||q.options.some(o=>!o.trim())||!q.options.includes(q.correct))))throw new ApiError("Confira alternativas e gabaritos.");
   }
  }else if(command.publish&&!(body as Article).content.trim())throw new ApiError("Escreva o conteúdo antes de publicar.");
  const {error}=await db.rpc("academy_mutate",{actor:me.id,command:{...command,data:command.kind==="course"?{...body,xp:courseXp(body as Course)}:body}});if(error)throw new ApiError(error.message);return;
 }
 if(command.type==="invite"){
  if(!DEPARTMENTS.some(d=>d===command.department))throw new ApiError("Selecione um setor da DeMaria.");
  if(!isAllowedCompanyEmail(command.email))throw new ApiError("Use um e-mail @demaria.com.br ou @sacdemaria.com.br.");
  const normalizedEmail=normalizeEmail(command.email);
  const site=process.env.NEXT_PUBLIC_SITE_URL;
  if(!site && !command.temporaryPassword)throw new ApiError("Configure o endereço do site para enviar convites.",503);
  if(command.managerId){const manager=await db.from("academy_profiles").select("role,status").eq("id",command.managerId).single();if(manager.error||manager.data.status!=="active"||manager.data.role==="student")throw new ApiError("Selecione um gestor ativo.");}
  const {data,error}=command.temporaryPassword ? await db.auth.admin.createUser({email:normalizedEmail,password:command.temporaryPassword,email_confirm:true,user_metadata:{name:command.name}}) : await db.auth.admin.inviteUserByEmail(normalizedEmail,{redirectTo:new URL("/acesso",site!).href,data:{name:command.name}});
  if(error||!data.user)throw new ApiError("Não foi possível criar o acesso. Confira se o e-mail já existe; para convites, confira também o SMTP no Supabase.");
  const profile=await db.from("academy_profiles").insert({id:data.user.id,name:command.name,email:normalizedEmail,department:command.department,manager_id:command.managerId||null,role:command.role,status:"active"});
  if(profile.error){await db.auth.admin.deleteUser(data.user.id);throw new ApiError("Não foi possível concluir a criação do acesso. Tente novamente.",503);}
  await db.from("academy_audit").insert({actor:me.id,action:"invite",resource:data.user.id});return;
 }
 if(command.type==="profile"){
  const existing=await db.from("academy_profiles").select("email,department").eq("id",command.data.id).single();
  if(existing.error||existing.data.email!==command.data.email)throw new ApiError("A alteração de e-mail exige um fluxo de confirmação e não está disponível neste editor.");
  if(existing.data.department!==command.data.department&&!DEPARTMENTS.some(d=>d===command.data.department))throw new ApiError("Selecione um setor da DeMaria.");
  if(command.data.status==="active"){
   try{await db.auth.admin.updateUserById(command.data.id,{email_confirm:true});}catch{}
  }
 }
 if(command.type==="settings"){
  const settings=await db.from("academy_settings").select(command.kind).single();ensure(settings);
  const values=(settings.data as unknown as Record<string,string[]>)[command.kind];
  if(values.some(v=>v.toLocaleLowerCase()===command.name.toLocaleLowerCase()&&v!==command.oldName))throw new ApiError("Já existe um cadastro com este nome.");
 }
 if(command.type==="video"){
  const previous=await db.from("academy_progress").select("ranges").eq("user_id",me.id).eq("course_id",command.courseId).eq("version",command.version).eq("lesson_id",command.lessonId).maybeSingle();ensure(previous);
  const watched=mergeWatched([...(previous.data?.ranges??[]),...command.ranges],command.duration);
  const {error}=await db.rpc("academy_mutate",{actor:me.id,command:{...command,ranges:watched.ranges,done:watched.seconds/command.duration>=0.9}});if(error)throw new ApiError(error.message);return;
 }
 const {error}=await db.rpc("academy_mutate",{actor:me.id,command});if(error)throw new ApiError(error.message);
}
