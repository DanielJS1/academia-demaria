import { courseValidationError, normalizeCourse } from "./course-activities";
import { createClient } from "@supabase/supabase-js";
import { isAllowedCompanyEmail, normalizeEmail, pendingStudentProfile } from "./registration-security";
import { DEPARTMENTS } from "./departments";
import { courseXp } from "./rewards";
import { videoIsComplete } from "./video-completion";
import { commandSchema, mergeWatched } from "./pilot-contract";
import { executeCommunity, readCommunity } from "./community-server";
import { courseSchema, articleSchema, vimeoEmbed, safeImage, type AcademyState, type Course, type Article, type Cartorio } from "./model";
export class ApiError extends Error { constructor(message:string,public status=400){super(message);} }
export function database(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)throw new ApiError("O Supabase ainda não foi configurado no servidor.",503);
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
export type Profile={id:string;name:string;email:string;department:string;manager_id:string|null;role:"admin"|"manager"|"student";status:"active"|"pending"|"inactive";audience?:"client"|"internal";cartorio_id?:string|null;avatar?:string|null};
export async function authenticate(request:Request){
 const token=request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
 if(!token)throw new ApiError("Entre na sua conta para continuar.",401);
 const db=database();const {data,error}=await db.auth.getUser(token);
 if(error||!data.user)throw new ApiError("Sua sessão expirou. Entre novamente.",401);
 let profile=await db.from("academy_profiles").select("*").eq("id",data.user.id).maybeSingle();
 let currentProfile: Profile | null = (profile.data as Profile) ?? null;
 if(!currentProfile){
  if(!data.user.email||!isAllowedCompanyEmail(data.user.email))throw new ApiError("Este e-mail não pertence a um domínio autorizado.",403);
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
  for(let offset=0;;offset+=1000){let query=db.from(table).select(columns).range(offset,offset+999);query=table==="academy_progress"?query.order("user_id").order("course_id").order("version").order("lesson_id"):query.order("id");if(field)query=query.eq(field,value!);const result=await query;if(result.error){if(table==="academy_cartorios")return {data:[],error:null};ensure(result);}const page=result.data??[];rows.push(...page as unknown as Record<string,any>[]);if(page.length<1000)break;}
  return {data:rows,error:null};
 }
 const results=await Promise.all([
  all("academy_resources","*","kind","course"),all("academy_profiles"),
  db.from("academy_settings").select("*").single(),
  all("academy_progress","user_id,course_id,version,lesson_id,done"),
  all("academy_attempts","*",me.role==="student"?"user_id":undefined,me.role==="student"?me.id:undefined),
  all("academy_xp"),db.from("academy_preferences").select("*").eq("user_id",me.id).maybeSingle(),
  all("academy_cartorios"),
 ]);
 results.forEach(ensure);
 const [resources,profiles,settings,progress,attempts,xp,preferences,cartoriosResult]=results;
 const community=await readCommunity(db,me);
 const courses:Course[]=(resources.data??[]).filter((r: any)=>r.kind==="course"&&r.published).map((r: any)=>({...r.published,xp:courseXp(r.published)}));
 const visibleCourses=courses.map(course=>me.role==="admin"?course:{...course,questions:course.questions.map(question=>({...question,correct:""})),lessons:course.lessons.map(l=>({...l,questions:l.questions?.map(q=>({...q,correct:""}))})),proficiencyQuestions:course.proficiencyQuestions?.map(q=>({...q,correct:""}))});
 const completion:Record<string,string[]>={};
 for(const row of progress.data??[])if(row.user_id===me.id&&row.done&&courses.some(c=>c.id===row.course_id&&c.version===row.version))(completion[row.course_id]??=[]).push(row.lesson_id);
 const season=new Date().toLocaleDateString("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric"});
 const norm = (s?: string) => (s || "").trim().toLowerCase();
 const managedIds=new Set((profiles.data??[]).filter((p: any)=>me.role==="admin"||p.id===me.id||(me.role==="manager"&&(p.manager_id===me.id||(!p.manager_id&&p.department&&norm(p.department)===norm(me.department))))).map((p: any)=>p.id));
 const teamProgress:Record<string,Record<string,string[]>>={};
 if(me.role==="admin"||me.role==="manager"){
  for(const row of progress.data??[]){
   if(row.done&&managedIds.has(row.user_id)&&courses.some(c=>c.id===row.course_id&&c.version===row.version)){
    (teamProgress[row.user_id]??={})[row.course_id]??=[];
    teamProgress[row.user_id][row.course_id].push(row.lesson_id);
   }
  }
 }
 const people=(profiles.data??[]).filter((p: any)=>p.status!=="inactive"||me.role==="admin"||p.id===me.id).map((p: any)=>{
  const report=me.role==="admin"||p.id===me.id||(me.role==="manager"&&(p.manager_id===me.id||(!p.manager_id&&p.department&&norm(p.department)===norm(me.department))));
  const total=courses.reduce((n: number,c: Course)=>n+c.lessons.filter(l=>l.type!=="quiz").length,0);
  const done=(progress.data??[]).filter((r: any)=>r.user_id===p.id&&r.done&&courses.some(c=>c.id===r.course_id&&c.version===r.version&&c.lessons.some(l=>l.id===r.lesson_id&&l.type!=="quiz"))).length;
  return {id:p.id,name:p.name,email:report?p.email:"",department:p.department,managerId:report?(p.manager_id??""):"",role:p.role,status:p.status,xp:(xp.data??[]).filter((x: any)=>x.user_id===p.id&&x.season===season).reduce((n: number,x: any)=>n+x.amount,0),progress:report&&total?Math.round(done/total*100):0,audience:(p.audience??"internal") as "internal"|"client",cartorioId:p.cartorio_id??undefined,avatar:p.avatar??null};
 });
 const cartorios:Cartorio[]=(cartoriosResult.data??[]).map((c: any)=>({
  id:c.id,name:c.name,city:c.city??"",uf:c.uf??"",cns:c.cns??undefined,modules:c.modules??[],
  keyUserId:c.key_user_id??undefined,keyUserName:c.key_user_name??undefined,keyUserEmail:c.key_user_email??undefined,
  status:c.status??"active",createdAt:c.created_at??new Date().toISOString()
 }));
 const visibleAttempts=(attempts.data??[]).filter((a: any)=>me.role==="admin"||managedIds.has(a.user_id));
 const state:AcademyState={schema:1,courses:visibleCourses,courseDrafts:me.role==="admin"?(resources.data??[]).filter((r: any)=>r.kind==="course"&&r.draft).map((r: any)=>r.draft):[],articles:community.articles,articleDrafts:community.articleDrafts,people,departments:settings.data.departments,products:settings.data.products,completed:completion,bookmarks:preferences.data?.bookmarks??[],readNotices:preferences.data?.read_notices??[],notifications:[],
  attempts:visibleAttempts.sort((a: any,b: any)=>a.submitted_at.localeCompare(b.submitted_at)).map((a: any)=>({id:a.id,userId:a.user_id,courseId:a.course_id,courseTitle:a.snapshot.title,courseVersion:a.version,quizId:a.quiz_id || a.snapshot.quizId || a.snapshot.lessons?.find((l:Course["lessons"][number])=>l.type==="quiz")?.id,questions:a.snapshot.questions.map((q:Course["questions"][number])=>me.role==="admin"?q:{...q,correct:""}),answers:a.answers,status:a.status,feedback:a.feedback,score:a.score,passingScore:a.snapshot.passingScore,xp:a.snapshot.xp,submittedAt:a.submitted_at,retryPolicy:a.snapshot.retryPolicy,retryAllowed:a.retry_allowed,correctTextIds:a.correct_text_ids??[],partialTextIds:a.partial_text_ids??[]})),
  xpEvents:(xp.data??[]).filter((x: any)=>x.user_id===me.id).map((x: any)=>({id:x.id,amount:x.amount,season:x.season,label:x.label})),
  teamProgress,cartorios};
 return {state,me:{id:me.id,name:me.name,email:me.email,department:me.department,role:me.role,audience:me.audience??"internal",cartorioId:me.cartorio_id??null,avatar:me.avatar??null}};
}
export async function executeCommand(db:ReturnType<typeof database>,me:Profile,input:unknown){
 const parsed=commandSchema.safeParse(input);if(!parsed.success)throw new ApiError("Revise os campos enviados. Há valores inválidos.");
 const command=parsed.data;
 if(command.type==="avatar"){
  const {error}=await db.from("academy_profiles").update({avatar:command.avatar}).eq("id",me.id);
  if(error)throw new ApiError("Não foi possível salvar a foto de perfil: "+error.message,500);
  await db.from("academy_audit").insert({actor:me.id,action:"avatar",resource:me.id});
  return;
 }
 if(command.type.startsWith("community-")){await executeCommunity(db,me,command);return;}
 if(command.type==="save-resource"&&command.kind==="article"){
  await executeCommunity(db,me,{type:"community-save",data:articleSchema.parse(command.data),publish:command.publish,expectedVersion:command.expectedVersion});return;
 }
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
 if(["save-resource","review","unlock","profile","settings","delete-setting","invite"].includes(command.type)&&me.role!=="admin")throw new ApiError("Somente administradores podem executar esta ação.",403);
 if(command.type==="save-resource"){
  const body=command.kind==="course"?courseSchema.parse(command.data):articleSchema.parse(command.data);
  if(command.kind==="course"){
   const course=body as Course;
   if(new Set(course.lessons.map(l=>l.id)).size!==course.lessons.length)throw new ApiError("Atividades duplicadas.");
   const problem=courseValidationError(course,command.publish);if(problem)throw new ApiError(problem);

  }else if(command.publish&&!(body as Article).content.trim())throw new ApiError("Escreva o conteúdo antes de publicar.");
  const {error}=await db.rpc("academy_mutate",{actor:me.id,command:{...command,data:command.kind==="course"?{...normalizeCourse(body as Course),xp:courseXp(body as Course)}:body}});if(error)throw new ApiError(error.message);return;
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
  const currentValues=((settings.data as unknown as Record<string,string[]>)[command.kind]||[]);
  if(currentValues.some(v=>v.toLocaleLowerCase()===command.name.toLocaleLowerCase()&&v!==command.oldName))throw new ApiError("Já existe um cadastro com este nome.");
  const newValues=command.oldName
    ? currentValues.map(v=>v===command.oldName ? command.name : v)
    : [...currentValues, command.name];
  const {error}=await db.from("academy_settings").update({[command.kind]:newValues}).eq("id",true);
  if(error)throw new ApiError("Não foi possível salvar a alteração.");
  if(command.oldName){
   if(command.kind==="departments"){
    await db.from("academy_profiles").update({department:command.name}).eq("department",command.oldName);
   }else{
    const res=await db.from("academy_resources").select("id,published,draft").eq("kind","course");
    if(res.data){
     for(const row of res.data){
      const p=row.published as Course|null;
      const d=row.draft as Course|null;
      if(p?.product===command.oldName || d?.product===command.oldName){
       await db.from("academy_resources").update({
        published:p?.product===command.oldName?{...p,product:command.name}:p,
        draft:d?.product===command.oldName?{...d,product:command.name}:d
       }).eq("id",row.id);
      }
     }
    }
   }
  }
  await db.from("academy_audit").insert({actor:me.id,action:"settings",resource:command.name});
  return;
 }
 if(command.type==="delete-setting"){
  const settings=await db.from("academy_settings").select(command.kind).single();ensure(settings);
  const values=((settings.data as unknown as Record<string,string[]>)[command.kind]||[]).filter(v=>v!==command.name);
  const {error}=await db.from("academy_settings").update({[command.kind]:values}).eq("id",true);
  if(error)throw new ApiError("Não foi possível excluir o cadastro.");
  await db.from("academy_audit").insert({actor:me.id,action:"delete-setting",resource:command.name});
  return;
 }
 if(command.type==="save-cartorio"){
  if(me.role!=="admin")throw new ApiError("Somente administradores podem gerenciar cartórios.",403);
  const {error}=await db.from("academy_cartorios").upsert({
   id:command.data.id,
   name:command.data.name,
   city:command.data.city,
   uf:command.data.uf,
   cns:command.data.cns,
   modules:command.data.modules,
   key_user_id:command.data.keyUserId,
   key_user_name:command.data.keyUserName,
   key_user_email:command.data.keyUserEmail,
   status:command.data.status,
  });
  if(error)throw new ApiError(error.message);
  return;
 }
 if(command.type==="delete-cartorio"){
  if(me.role!=="admin")throw new ApiError("Somente administradores podem gerenciar cartórios.",403);
  const {error}=await db.from("academy_cartorios").delete().eq("id",command.id);
  if(error)throw new ApiError(error.message);
  return;
 }
 if(command.type==="video"){
  const previous=await db.from("academy_progress").select("ranges").eq("user_id",me.id).eq("course_id",command.courseId).eq("version",command.version).eq("lesson_id",command.lessonId).maybeSingle();ensure(previous);
  const watched=mergeWatched([...(previous.data?.ranges??[]),...command.ranges],command.duration);
  const {error}=await db.rpc("academy_mutate",{actor:me.id,command:{...command,ranges:watched.ranges,done:videoIsComplete(watched.seconds,command.duration,command.position)}});if(error)throw new ApiError(error.message);return;
 }
 const {error}=await db.rpc("academy_mutate",{actor:me.id,command});if(error)throw new ApiError(error.message);
}
