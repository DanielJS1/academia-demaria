import { describe, it, expect } from "vitest";
import { managementSignal, managementAction, managementReportLink } from "./management";
import { DEFAULT_ALERT_POLICY, type Assignment } from "./trails";
import type { Person } from "./model";
import type { ReportRow } from "./reports/contracts";
import { questionAttention } from "./reports/question-attention";
const person = {id:"a",status:"active"} as Person;
const today="2026-10-13", policy={...DEFAULT_ALERT_POLICY,inactivityDays:7,lowAccessEnabled:true,lowAccessWindow:7,lowAccessMinDays:3};
const row = (lastAccessAt:string|null,days=1,observable=31,availability:"available"|"partial"="available"):ReportRow => ({type:"presence",id:"a",userId:"a",name:"Pessoa",department:"Suporte",lastAccessAt,metrics:[{id:"access_days",value:days,unit:"days",estimated:false,coverage:{availability,semantics:"period",observedFrom:null,observedUntil:null,...(availability==="partial"?{reason:"Coleta recente"}:{})}},{id:"observable_days",value:observable,unit:"days",estimated:false,coverage:{availability:"available",semantics:"period",observedFrom:null,observedUntil:null}}]});
const assignment={id:"trilha",userId:"a",active:true,complete:false,dueDate:"2026-10-12"} as Assignment;
describe("operational management",()=>{
  it("uses actual active incomplete deadlines, ignoring progress and overlapping assignments",()=>{
    expect(managementSignal(person,[assignment,{...assignment,id:"outro"}],policy,row("2026-10-12T12:00:00Z"),row("2026-10-12T12:00:00Z",7),today).overdue).toBe(true);
    for(const a of [{...assignment,complete:true},{...assignment,active:false},{...assignment,dueDate:today}])expect(managementSignal(person,[a],policy,undefined,undefined,today).overdue).toBe(false);
  });
  it("does not invent inactivity from absent, partial or short history",()=>{
    expect(managementSignal(person,[],{...policy,lowAccessEnabled:false},row(null),undefined,today).contact).toBeNull();
    expect(managementSignal(person,[],policy,row("2026-10-01T12:00:00Z",0,3,"partial"),row(null,0,3,"partial"),today).contact).toBeNull();
    expect(managementSignal(person,[],policy,row("2026-10-01T12:00:00Z",0,3),row(null,0,3),today).contact).toBeNull();
  });
  it("applies enabled thresholds only with sufficient coverage",()=>{
    expect(managementSignal(person,[],policy,row("2026-10-01T12:00:00Z"),row(null,7,7),today).contact).toBe(true);
    expect(managementSignal(person,[],policy,row("2026-10-12T12:00:00Z"),row(null,1,7),today).reason).toContain("Frequência");
    expect(managementSignal(person,[],{...policy,inactivityEnabled:false,lowAccessEnabled:false},undefined,undefined,today).contact).toBe(false);
    expect(managementSignal(person,undefined,undefined).overdue).toBeNull();
  });
  it("uses a partial larger period when the observed suffix fully covers the policy threshold",()=>{
    expect(managementSignal(person,[],{...policy,lowAccessEnabled:false},row("2026-10-01T12:00:00Z",0,17,"partial"),undefined,today).contact).toBe(true);
  });
  it("validates actions and confines report return URLs to the same person",()=>{
    expect(managementAction(null)).toBe("pdi");expect(()=>managementAction("aprovar")).toThrow();
    const back="/equipe/relatorios?visao=presenca&periodo=7&pessoa=a&formato=tabela";
    expect(managementReportLink("a",back)).toBe(back);
    for(const value of ["https://evil.test/equipe/relatorios?pessoa=a","//evil.test/equipe/relatorios?pessoa=a","/admin",back.replace("pessoa=a","pessoa=b")])expect(managementReportLink("a",value)).toContain("visao=geral");
  });
  it("aggregates diagnostics by version/activity/question without turning pending or partial into errors",()=>{
    const assessment=(id:string,version:number):ReportRow=>({type:"assessment",id,userId:"a",name:"Pessoa",department:"Suporte",courseId:"curso",courseVersion:version,activityId:"atividade",attemptId:id,status:"approved",metrics:[],diagnostic:{attemptId:id,score:70,questions:[{questionId:"q",outcome:id==="um"?"incorrect":"partial"}],counts:{correct:0,incorrect:id==="um"?1:0,partial:id==="um"?0:1,pending:0,unavailable:0}}});
    const groups=questionAttention([assessment("um",1),assessment("dois",1),assessment("tres",2)]);
    expect(groups).toHaveLength(2);expect(groups[0]).toMatchObject({incorrect:1,partial:1,graded:2,rate:50});
  });
});
