"use client";

import { useEffect, useMemo, useState } from "react";
import { browserAuth } from "@/lib/supabase-browser";
import { formatActiveTime, formatLastAccess, type EngagementMember, type EngagementReport } from "@/lib/engagement";
import { Button } from "./ui/button";

export function useTeamEngagement(userId: string, enabled: boolean) {
  const [days, setDays] = useState<7 | 30>(7);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ userId: string; days: number; revision: number; data?: EngagementReport; error?: string }>();
  useEffect(() => {
    if (!enabled) return;
    const abort = new AbortController();
    const load = async () => {
      try {
        const session = await browserAuth()?.auth.getSession();
        if (!session?.data.session || session.data.session.user.id !== userId) throw new Error("Entre novamente para consultar a presença.");
        const response = await fetch(`/api/engagement?days=${days}`, {
          headers: { Authorization: `Bearer ${session.data.session.access_token}` }, cache: "no-store", signal: abort.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Não foi possível consultar a presença.");
        if (!abort.signal.aborted) setResult({ userId, days, revision, data });
      } catch (error) {
        if (!abort.signal.aborted) setResult({ userId, days, revision, error: error instanceof Error ? error.message : "Não foi possível consultar a presença." });
      }
    };
    void load();
    return () => abort.abort();
  }, [userId, enabled, days, revision]);
  const current = result?.userId === userId && result.days === days && result.revision === revision ? result : undefined;
  const data = current?.data;
  const members = useMemo(() => new Map(data?.members.map(member => [member.userId, member]) ?? []), [data]);
  return { days, setDays, data, members, error: current?.error, loading: enabled && !current, refresh: () => setRevision(value => value + 1) };
}

export function EngagementControls({ report }: { report: ReturnType<typeof useTeamEngagement> }) {
  return <section className="panel team-engagement-controls" aria-label="Período de acompanhamento de presença" aria-busy={report.loading}>
    <div>
      <h2>Presença e constância</h2>
      <p>Consulte o último acesso e a participação para apoiar as conversas de PDI.</p>
    </div>
    <div className="team-engagement-actions">
      <label className="team-select-field">Período
        <select value={report.days} onChange={event => report.setDays(Number(event.target.value) as 7 | 30)}>
          <option value={7}>Últimos 7 dias</option><option value={30}>Últimos 30 dias</option>
        </select>
      </label>
      <Button variant="secondary" onClick={report.refresh} disabled={report.loading}>Atualizar presença</Button>
    </div>
    {report.loading && <p className="team-engagement-note" role="status">Carregando dados de presença…</p>}
    {report.error && <p className="team-engagement-note form-error" role="alert">{report.error} Use “Atualizar presença” para tentar novamente.</p>}
    {report.data && <p className="team-engagement-note">
      Coleta iniciada em {formatLastAccess(report.data.collectedSince)}. Histórico anterior indisponível.
      {" "}Os períodos incluem hoje, no horário de Brasília. Tempo ativo é uma estimativa de uso com a página visível e em foco;
      a contagem pausa após 2 minutos sem interação ou reprodução de vídeo e não gera XP.
      {" "}Dados atualizados em {formatLastAccess(report.data.generatedAt)}.
    </p>}
  </section>;
}

export function MemberEngagement({ member, days, unavailable }: { member?: EngagementMember; days: number; unavailable: boolean }) {
  return <section className="team-member-engagement" aria-label="Presença do colaborador">
    <h3>Presença nos últimos {days} dias</h3>
    {unavailable ? <p>Presença indisponível. Consulte o aviso no painel de gestão.</p> : !member?.lastAccessAt ?
      <p>Sem registro de acesso desde o início da coleta. Não há histórico anterior disponível.</p> : <>
        <dl className="team-engagement-summary">
          <div><dt>Último acesso</dt><dd>{formatLastAccess(member.lastAccessAt)}</dd></div>
          <div><dt>Dias com acesso</dt><dd>{member.activeDays} de {days}</dd></div>
          <div><dt>Tempo ativo estimado</dt><dd>{formatActiveTime(member.activeSeconds)}</dd></div>
        </dl>
        {member.daily.length > 0 ? <details><summary>Consultar presença por dia</summary>
          <ul className="team-engagement-days">{member.daily.slice().reverse().map(day => <li key={day.date}>
            <time dateTime={day.date}>{day.date.split("-").reverse().join("/")}</time><span>{formatActiveTime(day.activeSeconds)}</span>
          </li>)}</ul>
        </details> : <p>Nenhum acesso registrado no período selecionado.</p>}
      </>}
  </section>;
}
