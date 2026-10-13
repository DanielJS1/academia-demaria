// Isolated report fixtures; no database writes or private answer fields.
const day = () => new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const addDay=(d,n)=>new Date(Date.parse(d+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
const coverage=(semantics='period',availability='available')=>({availability,semantics,observedFrom:null,observedUntil:null,...(availability!=='available'?{reason:'Histórico anterior à coleta indisponível; cobertura parcial.'}:{})});
const metric=(id,value,unit='count',semantics='period',availability='available')=>({id,value,unit,estimated:unit==='minutes',coverage:coverage(semantics,availability)});
export function reportFixture(q,actor,state) {
  const UID = actor;
  const people=state.people.filter(p=>(!q.personId||p.id===q.personId)&&(!q.department||p.department.toLowerCase()===q.department.toLowerCase()));
  const now=new Date().toISOString(), end=q.period.kind==='custom'?q.period.endDate:day(), start=q.period.kind==='custom'?q.period.startDate:addDay(end,q.period.kind==='last7'?-6:-29);
  const period=q.view==='learning'&&q.learningMode==='current'?null:{startDate:start,endDate:end,startInclusive:start+'T03:00:00.000Z',endExclusive:addDay(end,1)+'T03:00:00.000Z',calendarDays:(Date.parse(end)-Date.parse(start))/86400000+1,timeZone:'America/Sao_Paulo'};
  let rows=people.map(p=>({id:p.id,userId:p.id,name:actor===UID?p.name:'Conta nova '+p.name,department:p.department,metrics:[]})), kpis=[],series=[];
  const i=p=>Number(p.id.slice(-12))-1;
  const per=(id,field=id)=>({id,metricId:field,points:rows.map(r=>({id:r.id,userId:r.userId,label:r.name,value:r.metrics.find(m=>m.id===field)?.value??null}))});
  const statusSeries=()=>({id:'course_status',metricId:'course_pairs',points:['not_started','in_progress','awaiting_assessment','completed'].map(s=>({id:s,label:s,value:rows.filter(r=>r.status===s).length}))});
  if(q.view==='overview') {
    rows=rows.map(r=>({...r,type:'person',metrics:[metric('people_with_access',1),metric('graded_attempts',2),metric('challenge_attempts',1),metric('xp_period',100,'xp')]}));
    kpis=[metric('people_with_access',rows.length),metric('graded_attempts',rows.length*2),metric('challenge_attempts',rows.length),metric('xp_period',rows.length*100,'xp')];
    series=[{id:'daily_access_people',metricId:'people_with_access',points:Array.from({length:7},(_,n)=>({id:addDay(end,n-6),label:addDay(end,n-6),date:addDay(end,n-6),value:Math.min(rows.length,n+1)}))},{id:'course_status',metricId:'course_pairs',points:['not_started','in_progress','awaiting_assessment','completed'].map((s,n)=>({id:s,label:s,value:Math.floor(rows.length/4)+(n<rows.length%4?1:0)}))}];
  } else if(q.view==='presence') {
    rows=rows.map(r=>({...r,type:'presence',lastAccessAt:i(r)===0?null:now,metrics:[metric('access_days',i(r)%7,'days'),metric('access_frequency',i(r)%7/30*100,'percent'),metric('active_minutes',(i(r)+1)*2,'minutes'),metric('observable_days',30,'days')]}));
    kpis=[metric('people_with_access',rows.length),metric('access_days',rows.length*3,'days'),metric('active_minutes',rows.length*5,'minutes'),metric('access_frequency',10,'percent')];
  } else if(q.view==='learning') {
    const cid=state.courses[0].id;
    if(q.learningDetail==='assessments') {
      rows=rows.map(r=>{const pending=i(r)%3===0,score=pending?null:(i(r)*7)%100;return {...r,id:'attempt-'+r.id,type:'assessment',courseId:cid,courseTitle:'Curso de teste',courseVersion:1,activityId:'atividade-1',attemptId:'attempt-'+r.id,submittedAt:now,feedback:'Feedback oficial',status:pending?'pending':score>=70?'approved':'retry',metrics:[metric('score',score,'percent')],diagnostic:{attemptId:'attempt-'+r.id,score,questions:[{questionId:'q1',outcome:pending?'pending':'correct'},{questionId:'q2',outcome:pending?'pending':'partial'}],counts:{correct:pending?0:1,incorrect:0,partial:pending?0:1,pending:pending?2:0,unavailable:0}}};});
      if(q.status)rows=rows.filter(r=>r.status===q.status);
      kpis=[metric('grade_average',70,'percent'),metric('people_with_grades',rows.filter(r=>r.status!=='pending').length),metric('graded_attempts',rows.filter(r=>r.status!=='pending').length),metric('pending_attempts',rows.filter(r=>r.status==='pending').length)];series=[per('person_grades','score')];
    } else {
      rows=rows.map(r=>{const n=i(r)%4,done=[0,2,4,4][n];return {...r,type:'course',courseId:cid,courseTitle:'Curso de teste',courseVersion:1,status:q.learningMode==='activity'?'completed':['not_started','in_progress','awaiting_assessment','completed'][n],...(q.learningMode==='activity'?{completedAt:now}:{}),assignments:q.learningScope==='assigned'?[{id:'assignment-'+r.id,dueDate:addDay(day(),-1),overdue:n!==3}]:[],metrics:q.learningMode==='activity'?[metric('period_completions',1)]:[metric('completed_lessons',done,'count','current'),metric('total_lessons',4,'count','current'),metric('lesson_progress',done*25,'percent','current'),metric('course_complete',n===3?1:0,'count','current')]};});
      if(q.courseId&&q.courseId!==cid)rows=[];if(q.status)rows=rows.filter(r=>r.status===q.status);
      kpis=q.learningMode==='activity'?[metric('period_completions',rows.length),metric('people_completing',rows.length)]:[metric('completed_courses',rows.filter(r=>r.status==='completed').length,'count','current'),metric('completion_rate',25,'percent','current'),metric('lesson_progress',62.5,'percent','current'),metric('overdue_people',q.learningScope==='assigned'?rows.filter(r=>r.status!=='completed').length:null,'count','current',q.learningScope==='assigned'?'available':'unavailable')];series=q.learningMode==='activity'?[per('person_completions','period_completions')]:[statusSeries()];
    }
  } else if(q.view==='challenges') {
    rows=rows.map(r=>({...r,type:'challenge',challengeId:'edicao-1',challengeTitle:'Desafio da semana',attemptId:'challenge-'+r.id,completedAt:now,passed:i(r)%3!==0,revision:i(r)===0?null:2,reviewAvailable:i(r)!==0,correctCount:i(r)===0?null:2,questionCount:i(r)===0?null:3,metrics:[metric('challenge_score',i(r)*3%100,'percent')]}));kpis=[metric('challenge_attempts',rows.length),metric('challenge_participants',rows.length),metric('challenge_average',50,'percent')];series=[per('person_challenge_scores','challenge_score')];
  } else if(q.view==='community') {
    const ids=['publications','comments_made','comments_received','like_made','like_received','hype_made','hype_received','like_active_made','like_active_received','hype_active_made','hype_active_received'];
    rows=rows.map(r=>({...r,type:'community',metrics:ids.map(id=>metric(id,i(r)+1,'count',id.includes('_active_')?'current':'period','partial'))}));kpis=ids.map(id=>metric(id,rows.length*3,'count',id.includes('_active_')?'current':'period','partial'));
  } else {
    const ids=['xp_period','xp_season','xp_history'];rows=rows.map(r=>({...r,type:'xp',metrics:ids.map((id,n)=>metric(id,n*100+(i(r)===0?-3:i(r)*10),'xp',n===0?'period':'current','partial'))}));kpis=ids.map((id,n)=>metric(id,rows.reduce((a,r)=>a+r.metrics[n].value,0),'xp',n===0?'period':'current','partial'));series=[per('person_xp','xp_period')];
  }
  return {schema:1,query:q,meta:{generatedAt:now,timeZone:'America/Sao_Paulo',period,actorId:actor,personIds:people.map(p=>p.id),departmentBasis:'current',complete:true,coverage:Object.fromEntries(kpis.map(m=>[m.id,m.coverage]))},rows,kpis,series};
}
