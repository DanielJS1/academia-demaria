begin;

create table public.academy_quizzes (
 id uuid primary key default gen_random_uuid(),
 title varchar(200) not null,
 slug varchar(120) not null unique,
 description text not null default '',
 category varchar(40) not null,
 xp_reward integer not null default 70 check (xp_reward between 0 and 500),
 passing_score integer not null default 70 check (passing_score between 0 and 100),
 period_type varchar(20) not null default 'weekly' check (period_type in ('weekly','biweekly','monthly')),
 is_active boolean not null default false,
 available_from timestamptz not null default now(),
 expires_at timestamptz,
 target_audience varchar(20) not null default 'internal' check (target_audience in ('internal','client')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check (expires_at is null or expires_at > available_from)
);

create table public.academy_quiz_questions (
 id uuid primary key default gen_random_uuid(),
 quiz_id uuid not null references public.academy_quizzes(id) on delete cascade,
 order_index integer not null check (order_index >= 0),
 prompt text not null check (char_length(trim(prompt)) > 0),
 options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) >= 2),
 correct_option_id varchar(40) not null,
 explanation text not null default '',
 unique (quiz_id, order_index)
);

create table public.academy_quiz_attempts (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 quiz_id uuid not null references public.academy_quizzes(id),
 score_percentage numeric(5,2) not null check (score_percentage between 0 and 100),
 answers jsonb not null check (jsonb_typeof(answers) = 'object'),
 passed boolean not null,
 xp_granted integer not null default 0 check (xp_granted >= 0),
 completed_at timestamptz not null default now(),
 unique (user_id, quiz_id)
);

create index academy_quizzes_active_window on public.academy_quizzes(target_audience, available_from) where is_active;
create index academy_quiz_questions_quiz on public.academy_quiz_questions(quiz_id, order_index);
create index academy_quiz_attempts_user on public.academy_quiz_attempts(user_id, completed_at desc);
create unique index academy_xp_quiz_event_unique on public.academy_xp(user_id, event_key)
 where course_id is null and event_key like 'quiz:%';

alter table public.academy_quizzes enable row level security;
alter table public.academy_quiz_questions enable row level security;
alter table public.academy_quiz_attempts enable row level security;
revoke all on public.academy_quizzes, public.academy_quiz_questions, public.academy_quiz_attempts from anon, authenticated;
grant all on public.academy_quizzes, public.academy_quiz_questions, public.academy_quiz_attempts to service_role;

-- Gabaritos e justificativas são modelos para revisão antes da ativação.
insert into public.academy_quizzes(title,slug,description,category,xp_reward,period_type) values
 ('Desafio Regional: Regras de Registro Civil - Alagoas','desafio-alagoas','Revisão regional; valide o conteúdo jurídico antes de ativar.','legislacao',70,'weekly'),
 ('Desafio Regional: Normas da Corregedoria - São Paulo','desafio-sao-paulo','Revisão regional; valide o conteúdo jurídico antes de ativar.','legislacao',70,'weekly'),
 ('Operação & Parâmetros: DOC-Fila','desafio-doc-fila','Revisão de configuração e operação do DOC-Fila.','sistema',60,'biweekly'),
 ('Diagnóstico & Resolução: Erros Gerais de Sistema','desafio-erros-gerais','Revisão de diagnóstico e encaminhamento de incidentes.','suporte',80,'biweekly'),
 ('Desafio PRO: Casos Complexos & Perguntas Difíceis','desafio-pro-perguntas-dificeis','Casos avançados para revisão editorial.','pro',120,'monthly'),
 ('Fiscal & Faturamento: Nota Fiscal em Cartórios','desafio-nota-fiscal','Revisão de rotinas fiscais; valide com a equipe responsável antes de ativar.','fiscal',70,'monthly');

insert into public.academy_quiz_questions(quiz_id,order_index,prompt,options,correct_option_id,explanation)
select q.id, s.order_index, s.prompt, s.options::jsonb, s.correct_option_id, s.explanation
from (values
 ('desafio-alagoas',0,'[Revisar] Em qual fonte oficial deve ser conferida a regra vigente para este caso em Alagoas?','[{"id":"a","text":"Normas oficiais atualizadas da Corregedoria de Alagoas"},{"id":"b","text":"Uma anotação sem data"},{"id":"c","text":"Uma regra de outra unidade federativa"}]','a','[Revisar] Confirme a fonte e substitua por uma justificativa específica.'),
 ('desafio-alagoas',1,'[Revisar] O que fazer ao identificar divergência entre um procedimento interno e a norma estadual vigente?','[{"id":"a","text":"Registrar a divergência e consultar a equipe responsável"},{"id":"b","text":"Ignorar a divergência"},{"id":"c","text":"Aplicar automaticamente a norma de outro estado"}]','a','[Revisar] Descreva o procedimento interno aprovado.'),
 ('desafio-sao-paulo',0,'[Revisar] Qual fonte consultar para confirmar a redação atual das normas da Corregedoria de São Paulo?','[{"id":"a","text":"Publicação oficial vigente"},{"id":"b","text":"Captura de tela antiga"},{"id":"c","text":"Regra informal de outro estado"}]','a','[Revisar] Cite a publicação oficial aplicável.'),
 ('desafio-sao-paulo',1,'[Revisar] Como tratar uma dúvida sobre atualização normativa regional?','[{"id":"a","text":"Conferir a versão vigente e encaminhar a dúvida"},{"id":"b","text":"Presumir que não houve mudança"},{"id":"c","text":"Alterar a orientação sem validação"}]','a','[Revisar] Indique o fluxo de validação aprovado.'),
 ('desafio-doc-fila',0,'[Revisar] Antes de alterar um parâmetro do DOC-Fila, qual informação deve ser registrada?','[{"id":"a","text":"Valor atual, motivo e impacto esperado"},{"id":"b","text":"Somente o nome do operador"},{"id":"c","text":"Nenhuma informação"}]','a','[Revisar] Adapte à rotina real do produto.'),
 ('desafio-doc-fila',1,'[Revisar] Como verificar o efeito de uma alteração de configuração?','[{"id":"a","text":"Conferir o comportamento e os registros após a mudança"},{"id":"b","text":"Considerar a mudança concluída sem conferir"},{"id":"c","text":"Descartar os registros de erro"}]','a','[Revisar] Descreva a verificação específica do DOC-Fila.'),
 ('desafio-erros-gerais',0,'[Revisar] Qual evidência ajuda a reproduzir um erro de sistema?','[{"id":"a","text":"Passos, horário e mensagem de erro"},{"id":"b","text":"Somente a palavra erro"},{"id":"c","text":"Uma hipótese sem observações"}]','a','[Revisar] Informe os dados aceitos no atendimento.'),
 ('desafio-erros-gerais',1,'[Revisar] O que fazer quando a causa de um erro ainda não foi confirmada?','[{"id":"a","text":"Registrar hipóteses e investigar com evidências"},{"id":"b","text":"Informar causa definitiva sem teste"},{"id":"c","text":"Encerrar o incidente imediatamente"}]','a','[Revisar] Relacione ao fluxo de suporte.'),
 ('desafio-pro-perguntas-dificeis',0,'[Revisar] Como documentar a decisão em um caso complexo com múltiplas alternativas?','[{"id":"a","text":"Registrar critérios, evidências e responsáveis"},{"id":"b","text":"Registrar apenas a conclusão"},{"id":"c","text":"Omitir as exceções"}]','a','[Revisar] Substitua por um caso real validado.'),
 ('desafio-pro-perguntas-dificeis',1,'[Revisar] O que fazer quando dois requisitos parecem incompatíveis?','[{"id":"a","text":"Identificar o conflito e buscar decisão fundamentada"},{"id":"b","text":"Ignorar um requisito sem registro"},{"id":"c","text":"Escolher aleatoriamente"}]','a','[Revisar] Substitua por uma justificativa técnica específica.'),
 ('desafio-nota-fiscal',0,'[Revisar] Onde confirmar os dados exigidos para a emissão fiscal de um cartório?','[{"id":"a","text":"No procedimento fiscal vigente e nos dados validados do cliente"},{"id":"b","text":"Em um exemplo antigo de outro cliente"},{"id":"c","text":"Por suposição"}]','a','[Revisar] Valide os requisitos fiscais atuais.'),
 ('desafio-nota-fiscal',1,'[Revisar] Como proceder diante de uma divergência nos dados de faturamento?','[{"id":"a","text":"Suspender a emissão e confirmar os dados com o responsável"},{"id":"b","text":"Emitir mesmo assim"},{"id":"c","text":"Alterar os dados sem registro"}]','a','[Revisar] Adapte ao fluxo fiscal aprovado.')
) as s(slug,order_index,prompt,options,correct_option_id,explanation)
join public.academy_quizzes q on q.slug=s.slug;

-- A correção, a tentativa e o prêmio formam uma única transação PostgreSQL.
create function public.academy_submit_periodic_quiz(actor uuid, quiz uuid, submitted_answers jsonb)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare
 current_quiz public.academy_quizzes;
 question_count integer;
 correct_count integer;
 score numeric(5,2);
 did_pass boolean;
 reward integer;
 attempt_id uuid;
 details jsonb;
begin
 if not exists(select 1 from public.academy_profiles p where p.id=actor and p.status='active') then
  raise exception 'Perfil não autorizado';
 end if;
 select * into current_quiz from public.academy_quizzes where id=quiz for update;
 if not found or not current_quiz.is_active or current_quiz.available_from > now()
   or (current_quiz.expires_at is not null and current_quiz.expires_at <= now())
   or not exists(select 1 from public.academy_profiles p where p.id=actor and coalesce(p.audience,'internal')=current_quiz.target_audience)
 then raise exception 'Desafio indisponível'; end if;
 if jsonb_typeof(submitted_answers) is distinct from 'object' then raise exception 'Respostas inválidas'; end if;
 select count(*) into question_count from public.academy_quiz_questions where quiz_id=quiz;
 if question_count < 2 or (select count(*) from jsonb_object_keys(submitted_answers)) <> question_count
   or exists (
    select 1 from public.academy_quiz_questions q
    where q.quiz_id=quiz and not exists (
     select 1 from jsonb_array_elements(q.options) option
     where option->>'id'=submitted_answers->>q.id::text
    )
   ) then raise exception 'Respostas incompletas ou inválidas'; end if;
 select count(*) filter (where submitted_answers->>q.id::text=q.correct_option_id),
        jsonb_agg(jsonb_build_object('questionId',q.id,'selectedOptionId',submitted_answers->>q.id::text,
          'correctOptionId',q.correct_option_id,'correct',submitted_answers->>q.id::text=q.correct_option_id,
          'explanation',q.explanation) order by q.order_index)
 into correct_count, details from public.academy_quiz_questions q where q.quiz_id=quiz;
 score := round(100.0 * correct_count / question_count, 2);
 did_pass := score >= current_quiz.passing_score;
 reward := case when did_pass then current_quiz.xp_reward else 0 end;
 insert into public.academy_quiz_attempts(user_id,quiz_id,score_percentage,answers,passed,xp_granted)
 values(actor,quiz,score,submitted_answers,did_pass,reward)
 on conflict(user_id,quiz_id) do nothing returning id into attempt_id;
 if attempt_id is null then return jsonb_build_object('alreadySubmitted',true); end if;
 if reward > 0 then
  insert into public.academy_xp(user_id,course_id,event_key,amount,season,label)
  values(actor,null,'quiz:'||quiz::text,reward,to_char(now() at time zone 'America/Sao_Paulo','YYYY'),'Desafio · '||current_quiz.title);
 end if;
 return jsonb_build_object('attemptId',attempt_id,'scorePercentage',score,'passed',did_pass,
  'xpGranted',reward,'correctCount',correct_count,'questionCount',question_count,'results',details);
end;
$$;
revoke all on function public.academy_submit_periodic_quiz(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.academy_submit_periodic_quiz(uuid,uuid,jsonb) to service_role;

commit;
