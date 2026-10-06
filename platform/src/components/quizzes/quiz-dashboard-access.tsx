"use client";

import Link from "next/link";
import { ArrowRight, Zap } from "lucide-react";
import { useQuizSummary } from "./quiz-summary-provider";

export function QuizDashboardAccess() {
  const { data, error, loading, simulated } = useQuizSummary();
  const count = data?.available.length ?? 0;
  return <section className="panel quiz-dashboard-access" aria-label="Central de desafios">
    <div><Zap size={22} aria-hidden="true"/><span><strong>Desafios</strong><small>{simulated ? "Encerre a simulação para acessar sua conta." : error ? "Acesse a central para tentar novamente." : loading && !data ? "Consultando disponíveis…" : `${count} ${count === 1 ? "disponível" : "disponíveis"} · seus resultados em um só lugar`}</small></span></div>
    <Link className="text-link" href="/desafios">Ver todos os desafios <ArrowRight size={17} aria-hidden="true"/></Link>
  </section>;
}
