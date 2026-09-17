"use client";

import { useState } from "react";
import Link from "next/link";
import { Award, BookOpen, CheckCircle2, ChevronRight, Clock, FileCheck, Layers, PlayCircle, ShieldCheck, Sparkles } from "lucide-react";
import { useAcademy } from "./academy-provider";
import { Button } from "./ui/button";
import { CourseCard, EmptyState, PageHeading, SectionHeading } from "./shared";
import { CertificateModal } from "./certificate-modal";
import { isCourseAvailableForCartorio, courseProgress, type Cartorio, type Course } from "@/lib/model";
import { formatModuleName } from "@/lib/cartorio-modules";

interface ClientDashboardProps {
  cartorio: Cartorio;
}

export function ClientDashboard({ cartorio }: ClientDashboardProps) {
  const { state, me } = useAcademy();
  const [certOpen, setCertOpen] = useState(false);

  // Filter courses available for this cartório
  const clientCourses = state.courses.filter(course =>
    course.status === "published" && isCourseAvailableForCartorio(course, cartorio)
  );

  // Completed courses
  const isCourseDone = (c: Course) => {
    const prog = courseProgress(c, state.completed[c.id] || [], cartorio.uf);
    return prog === 100;
  };

  const completedCourses = clientCourses.filter(isCourseDone);
  const totalCourses = clientCourses.length;
  const overallProgress = totalCourses ? Math.round((completedCourses.length / totalCourses) * 100) : 0;
  const isCertified = totalCourses > 0 && completedCourses.length === totalCourses;

  // Active / continuing courses
  const continuing = clientCourses
    .filter(c => !isCourseDone(c))
    .sort((a, b) => {
      const aDone = (state.completed[a.id] || []).length > 0;
      const bDone = (state.completed[b.id] || []).length > 0;
      return Number(bDone) - Number(aDone);
    });

  return (
    <div className="page-enter client-dashboard">
      <PageHeading
        eyebrow={`CARTÓRIO PARCEIRO · ${cartorio.uf}`}
        title={cartorio.name}
        description={`Portal de capacitação e certificação técnica operacional DeMaria — Usuário-chave: ${me.name}.`}
      >
        {isCertified ? (
          <Button variant="mint" onClick={() => setCertOpen(true)}>
            <Award size={17} /> Emitir Certificado Oficial
          </Button>
        ) : (
          <Button asChild variant="secondary">
            <Link href="/aprender">
              <BookOpen size={16} /> Explorar Meus Cursos
            </Link>
          </Button>
        )}
      </PageHeading>

      {/* Certification Status Hero */}
      <div className="client-hero panel">
        <div className="client-hero-content">
          <div className="client-hero-badge">
            <ShieldCheck size={18} />
            <span>CERTIFICAÇÃO DEMARIA · MÓDULOS CONTRATADOS</span>
          </div>
          <h2>
            {isCertified
              ? "Parabéns! Sua capacitação foi concluída com sucesso."
              : "Sua trilha de capacitação está em andamento."}
          </h2>
          <p>
            {isCertified
              ? `O ${cartorio.name} completou 100% dos cursos técnicos relativos aos módulos contratados. Seu certificado oficial está disponível para download e impressão.`
              : `Você concluiu ${completedCourses.length} de ${totalCourses} cursos disponíveis para os módulos contratados pelo cartório. Conclua todas as atividades para emitir sua certificação.`}
          </p>

          <div className="client-progress-bar-wrap">
            <div className="client-progress-info">
              <span>Progresso geral da serventia</span>
              <strong>{overallProgress}%</strong>
            </div>
            <div className="client-progress-track">
              <div className="client-progress-fill" style={{ width: `${overallProgress}%` }} />
            </div>
          </div>

          <div className="client-hero-actions">
            {isCertified ? (
              <Button variant="mint" onClick={() => setCertOpen(true)}>
                <Award size={18} /> Visualizar Certificado DeMaria
              </Button>
            ) : continuing[0] ? (
              <Button asChild variant="default">
                <Link href={`/aprender/${continuing[0].id}/aula`}>
                  <PlayCircle size={18} /> Continuar: {continuing[0].title}
                </Link>
              </Button>
            ) : (
              <Button asChild variant="secondary">
                <Link href="/aprender">
                  <BookOpen size={18} /> Iniciar primeiro curso
                </Link>
              </Button>
            )}
          </div>
        </div>

        <div className="client-hero-stat-card">
          <div className="client-stat-item">
            <span className="client-stat-label">Estado / UF</span>
            <strong className="client-stat-val highlight">{cartorio.uf}</strong>
            <small>Regras estaduais de selagem ativas</small>
          </div>
          <div className="client-stat-item">
            <span className="client-stat-label">Módulos Contratados</span>
            <strong className="client-stat-val">{cartorio.modules.length}</strong>
            <small>Sistemas e rotinas habilitadas</small>
          </div>
          <div className="client-stat-item">
            <span className="client-stat-label">Cursos Concluídos</span>
            <strong className="client-stat-val">
              {completedCourses.length} <span style={{ fontSize: 16, color: "var(--muted)" }}>/ {totalCourses}</span>
            </strong>
            <small>{isCertified ? "100% dos requisitos atingidos" : "Em conformidade com a trilha"}</small>
          </div>
        </div>
      </div>

      {/* Continue watching / Current Courses */}
      <section className="client-section" style={{ marginTop: 32 }}>
        <SectionHeading
          title="Cursos da Trilha Contratada"
          description="Conteúdos selecionados com base nos módulos ativos do seu cartório."
          href="/aprender"
          link="Ver catálogo completo"
        />

        {clientCourses.length > 0 ? (
          <div className="course-grid">
            {clientCourses.map(course => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Nenhum curso disponível no momento"
            description="Os cursos dos módulos contratados pelo seu cartório estão sendo gravados e preparados para o ambiente de 2027."
          />
        )}
      </section>

      {/* Contracted Modules Overview */}
      <section className="client-section panel" style={{ marginTop: 32, padding: 24 }}>
        <div className="section-title">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Layers size={20} className="icon-muted" />
            <div>
              <h3 style={{ margin: 0, fontSize: 17 }}>Módulos Contratados pelo Cartório</h3>
              <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
                Relação dos módulos contratados que compõem o escopo de certificação desta serventia.
              </p>
            </div>
          </div>
          <span className="badge-count">{cartorio.modules.length} módulos ativos</span>
        </div>

        <div className="client-modules-grid" style={{ marginTop: 18 }}>
          {cartorio.modules.map(modKey => (
            <div key={modKey} className="client-module-card">
              <CheckCircle2 size={16} style={{ color: "var(--mint-11)", flexShrink: 0 }} />
              <span>{formatModuleName(modKey)}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Certificate Modal */}
      <CertificateModal
        studentName={cartorio.keyUserName || me.name}
        cartorio={cartorio}
        isOpen={certOpen}
        onClose={() => setCertOpen(false)}
      />
    </div>
  );
}
