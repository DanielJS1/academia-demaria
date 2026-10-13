"use client";
import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import type { ReportRow } from "@/lib/reports/contracts";
import { formatReportDate, formatMetric, statusLabels } from "@/lib/reports/presentation";
import { Button } from "../ui/button";
const outcomes = { correct: "Correta", incorrect: "Incorreta", partial: "Crédito parcial", pending: "Aguardando correção", unavailable: "Diagnóstico indisponível" };
export function AssessmentDialog({ row, onClose }: { row: Extract<ReportRow, { type: "assessment" }>; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null), titleId = useId();
  useEffect(() => { ref.current?.showModal(); }, []);
  const diagnostic = row.diagnostic;
  return <dialog ref={ref} className="reports-assessment-dialog" aria-labelledby={titleId} onClose={onClose}>
    <div className="reports-dialog-heading"><div><h2 id={titleId}>Diagnóstico da avaliação</h2><p>{row.name} · {row.courseTitle ?? row.courseId} · versão {row.courseVersion ?? "legada"}</p></div><Button type="button" variant="ghost" size="icon" aria-label="Fechar diagnóstico" onClick={() => ref.current?.close()}><X aria-hidden="true" /></Button></div>
    <p>{statusLabels[row.status]} · envio em {formatReportDate(row.submittedAt)}</p><p><strong>Nota oficial: {formatMetric(diagnostic?.score ?? null, "percent")}</strong></p>
    {diagnostic ? <><dl className="reports-diagnostic-counts">{Object.entries(diagnostic.counts).map(([kind, count]) => <div key={kind}><dt>{outcomes[kind as keyof typeof outcomes]}</dt><dd>{count}</dd></div>)}</dl><ol className="reports-diagnostic-questions">{diagnostic.questions.map((question, index) => <li key={question.questionId}>Questão {index + 1}: <strong>{outcomes[question.outcome]}</strong></li>)}</ol></> : <p>Este registro não possui diagnóstico disponível.</p>}
    <h3>Feedback</h3><p className="reports-feedback">{row.feedback || "Sem feedback registrado."}</p><Button type="button" variant="secondary" onClick={() => ref.current?.close()}>Fechar</Button>
  </dialog>;
}
