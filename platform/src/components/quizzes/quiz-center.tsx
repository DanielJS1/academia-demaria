"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock3, ListChecks, Sparkles, Zap } from "lucide-react";
import { useAcademy } from "../academy-provider";
import { PageHeading, SectionHeading } from "../shared";
import { Button } from "../ui/button";
import { useQuizSummary } from "./quiz-summary-provider";
import { QuizNotificationControl } from "./quiz-notification-control";

export const quizCategoryNames: Record<string, string> = { legislacao: "Legislação", sistema: "Sistema", suporte: "Suporte", pro: "PRO", fiscal: "Fiscal" };
const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
export function QuizSimulationNotice() {
  const { setSimulatedCartorioId } = useAcademy();
  return <section className="panel quiz-center-state" role="status"><h2>Desafios são pessoais</h2>
    <p>Encerre a simulação para acessar os desafios da sua conta. Nenhuma tentativa ou XP será registrado em nome do cartório simulado.</p>
    <Button type="button" onClick={() => setSimulatedCartorioId(null)}>Encerrar simulação e acessar meus desafios</Button></section>;
}

export function QuizCenter() {
  const { data, loading, error, simulated, reload } = useQuizSummary();
  const available = data?.available ?? [];
  const completed = data?.completed ?? [];
  return <div className="quiz-center page-enter">
    <PageHeading eyebrow="APRENDA E EVOLUA" title="Desafios" description="Teste seus conhecimentos e acompanhe seus resultados. Uma tentativa oficial por edição.">
      <span className="quiz-center-count" role="status"><Zap size={17} aria-hidden="true"/>{simulated ? "Acesso pessoal" : loading && !data ? "Carregando…" : error ? "Consulta indisponível" : `${available.length} ${available.length === 1 ? "desafio disponível" : "desafios disponíveis"}`}</span>
    </PageHeading>
    <QuizNotificationControl/>
    {simulated ? <QuizSimulationNotice/> : error ? <section className="panel quiz-center-state" role="alert">
      <h2>Não foi possível consultar os desafios</h2><p>{error}</p><Button type="button" disabled={loading} onClick={reload}>{loading ? "Tentando…" : "Tentar novamente"}</Button>
    </section> : loading && !data ? <section className="panel quiz-center-state" role="status"><ListChecks size={28} aria-hidden="true"/><p>Carregando seus desafios e resultados…</p></section> : <>
      <section aria-labelledby="quiz-available-title" aria-busy={loading}>
        <div id="quiz-available-title"><SectionHeading title="Disponíveis" description="Escolha um desafio para começar. As respostas em andamento não são salvas após recarregar a página."/></div>
        {available.length ? <div className="quiz-center-grid">{available.map(quiz => <article className="panel quiz-center-card" key={quiz.id}>
          <span className="quiz-category">{quizCategoryNames[quiz.category] ?? quiz.category}</span><h3>{quiz.title}</h3>
          {quiz.description && <p>{quiz.description}</p>}
          <dl className="quiz-center-facts"><div><dt>Perguntas</dt><dd>{quiz.questionCount}</dd></div><div><dt>Prêmio de aprovação</dt><dd><Sparkles size={15} aria-hidden="true"/>{quiz.xp_reward} XP</dd></div>
            <div><dt>Acertos mínimos</dt><dd>{quiz.requiredCorrect} de {quiz.questionCount} · corte {quiz.passing_score}%</dd></div>
            <div><dt><Clock3 size={14} aria-hidden="true"/> Prazo</dt><dd>{quiz.expires_at ? <time dateTime={quiz.expires_at}>{dateFormat.format(new Date(quiz.expires_at))}</time> : "Sem data de encerramento"}</dd></div></dl>
          <Button asChild><Link href={`/desafios/${quiz.id}`} aria-label={`Começar: ${quiz.title}`}>Começar <ArrowRight size={17} aria-hidden="true"/></Link></Button>
        </article>)}</div> : <div className="panel quiz-center-state"><CheckCircle2 size={30} aria-hidden="true"/>
          <h3>{completed.length ? "Você concluiu todos os desafios disponíveis" : "Nenhum desafio publicado no momento"}</h3>
          <p>{completed.length ? "Seus resultados continuam disponíveis abaixo. Volte para conferir novas edições." : "Quando novos desafios forem publicados para seu público, eles aparecerão aqui."}</p>
        </div>}
      </section>
      <section aria-labelledby="quiz-completed-title"><div id="quiz-completed-title"><SectionHeading title="Concluídos" description="Seu resultado oficial e XP registrado permanecem no histórico, mesmo após o encerramento do desafio."/></div>
        {completed.length ? <div className="quiz-center-grid">{completed.map(({ id, title, result }) => <article className="panel quiz-center-card" key={id}>
          <span className="quiz-category"><CheckCircle2 size={15} aria-hidden="true"/> {result.passed ? "Aprovado" : "Concluído · corte não atingido"}</span><h3>{title}</h3>
          <dl className="quiz-center-facts"><div><dt>Aproveitamento</dt><dd>{result.scorePercentage}%</dd></div><div><dt>XP registrado</dt><dd>{result.xpGranted} XP</dd></div>
            <div><dt>Acertos / corte utilizado</dt><dd>{result.correctCount === null ? "Histórico detalhado indisponível" : `${result.correctCount} de ${result.questionCount} · corte ${result.passingScore}%`}</dd></div>
            <div><dt>Concluído em</dt><dd><time dateTime={result.completedAt}>{dateFormat.format(new Date(result.completedAt))}</time></dd></div></dl>
          <Button asChild variant="secondary"><Link href={`/desafios/${id}`} aria-label={`Ver resultado: ${title}`}>Ver resultado <ArrowRight size={17} aria-hidden="true"/></Link></Button>
        </article>)}</div> : <p className="quiz-center-empty">Você ainda não concluiu um desafio.</p>}
      </section>
    </>}
  </div>;
}
