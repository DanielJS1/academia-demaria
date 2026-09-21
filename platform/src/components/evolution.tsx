"use client";

import { useState } from "react";
import { isCourseComplete } from "@/lib/rewards";
import Link from "next/link";
import { ArrowRight, Award, Camera, Gem, KeyRound, Medal, Shield, Sparkles, Trash2, Trophy } from "lucide-react";
import { useAcademy } from "./academy-provider";
import { Button } from "./ui/button";
import { EmptyState, PageHeading, Progress, SectionHeading } from "./shared";
import { experience, tiers, DEMO_SEASON } from "@/lib/gamification";
import { initials, number } from "@/lib/utils";
import { ProfilePhotoModal } from "./profile-photo-modal";
import { PasswordChangeModal } from "./password-change-modal";

export function Evolution() {
  const { state, me, avatar, setAvatar, notify } = useAcademy();
  const xp = experience(state);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  const people = state.people
    .filter((person) => person.status === "active")
    .map((person) => (person.id === me.id ? { ...person, xp: xp.annual } : person))
    .sort((a, b) => b.xp - a.xp);

  const approved = state.attempts.filter(
    (attempt, index, attempts) =>
      attempt.status === "approved" &&
      attempt.userId === me.id &&
      state.courses.some((c) => c.id === attempt.courseId && isCourseComplete(c, state, me.id)) &&
      attempts.findIndex(
        (item) => item.userId === me.id && item.courseId === attempt.courseId && item.status === "approved"
      ) === index
  );

  const withoutQuiz = state.courses.filter(
    (course) => !course.lessons.some((l) => l.type === "quiz") && isCourseComplete(course, state, me.id)
  );

  return (
    <div className="page-enter">
      <PageHeading
        eyebrow="SEU CONHECIMENTO DEIXA MARCAS"
        title="Toda evolução conta."
        description="Celebre seu caminho e descubra o que vem depois."
      >
        <span className="season-pill">
          <span /> Temporada {DEMO_SEASON}
        </span>
      </PageHeading>

      {/* Painel de Gestão de Perfil, Foto e Senha Exclusiva */}
      <section className="evolution-profile-card">
        <div className="profile-card-left">
          <div className="profile-card-avatar-wrap">
            <div className="profile-card-avatar">
              {avatar ? (
                <img src={avatar} alt={me.name} className="profile-card-img" />
              ) : (
                <span className="profile-card-initial">{initials(me.name)}</span>
              )}
            </div>
          </div>
          <div className="profile-card-avatar-actions">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="profile-card-btn"
              onClick={() => setIsPhotoModalOpen(true)}
              title="Alterar foto de perfil"
            >
              <Camera size={14} />
              <span>{avatar ? "Alterar foto" : "Adicionar foto"}</span>
            </Button>
            {avatar && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="profile-card-remove-btn"
                onClick={() => {
                  setAvatar(null);
                  notify("Foto de perfil removida.");
                }}
                title="Remover foto"
              >
                <Trash2 size={14} />
                <span>Remover</span>
              </Button>
            )}
          </div>
        </div>

        <div className="profile-card-center">
          <span className="profile-card-eyebrow">SEU PERFIL</span>
          <h2 className="profile-card-name">{me.name}</h2>
          <span className="profile-card-email">{me.email}</span>
          <div className="profile-card-tags">
            {me.department && (
              <span className="profile-tag department-tag">
                {me.department}
              </span>
            )}
            <span className="profile-tag role-tag">
              {me.role === "admin" ? "Administrador" : me.role === "manager" ? "Gestor" : "Colaborador"}
            </span>
          </div>
        </div>

        <div className="profile-card-right">
          <div className="profile-card-stats">
            <div className="profile-stat-box">
              <span className="stat-label">Nível</span>
              <strong className="stat-value level-stat">
                <Gem size={15} /> Nível {xp.level}
              </strong>
            </div>
            <div className="profile-stat-box">
              <span className="stat-label">Experiência</span>
              <strong className="stat-value xp-stat">
                {number(xp.total)} <small>XP</small>
              </strong>
            </div>
          </div>

          <div className="profile-card-security">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="profile-change-password-btn"
              onClick={() => setIsPasswordModalOpen(true)}
            >
              <KeyRound size={14} />
              <span>Alterar senha</span>
            </Button>
          </div>
        </div>
      </section>

      {/* Hero de Trajetória da Gamificação */}
      <section className="evolution-hero">
        <span className="evolution-emblem">
          <Gem size={65} strokeWidth={1} />
        </span>
        <div>
          <div className="hero-eyebrow">SUA TRAJETÓRIA</div>
          <h2>Nível {xp.level} · Explorador</h2>
          <p>Um passo de cada vez. Um novo mundo a descobrir.</p>
          <Progress value={xp.levelProgress} label="Progresso para o próximo nível" />
          <p style={{ marginTop: 8, fontSize: 9 }}>{400 - (xp.total % 400)} XP para o próximo nível</p>
        </div>
        <div className="evolution-xp">
          <strong>
            {number(xp.total)} <small>XP</small>
          </strong>
          <small>experiência acumulada</small>
        </div>
      </section>

      <SectionHeading
        title="Uma temporada de possibilidades"
        description={`Sua faixa atual: ${xp.tier.name} · ${number(xp.annual)} XP nesta temporada`}
      />
      <div className="milestones">
        {tiers.map((tier, index) => {
          const Icon = index === 4 ? Gem : index === 3 ? Trophy : Medal;
          return (
            <div
              className={`milestone ${xp.annual >= tier.xp ? "reached" : ""} ${
                xp.tier.name === tier.name ? "current" : ""
              }`}
              key={tier.name}
            >
              <Icon size={33} strokeWidth={1.3} />
              <strong>{tier.name}</strong>
              <small>{number(tier.xp)} XP</small>
            </div>
          );
        })}
      </div>

      <SectionHeading
        title="Entenda como funciona sua evolução"
        description="Nível e Faixa têm propósitos diferentes: um valoriza seu legado permanente e o outro mede seu ritmo na temporada."
      />
      <div
        className="evolution-rules-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 18,
          marginBottom: 28,
        }}
      >
        <div className="panel" style={{ padding: 22, borderLeft: "4px solid var(--primary)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Gem size={20} style={{ color: "var(--primary)" }} />
            <h3 style={{ fontSize: 15, margin: 0 }}>Como você sobe de NÍVEL</h3>
          </div>
          <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.7, margin: 0 }}>
            O <strong>Nível</strong> representa sua trajetória <strong>permanente e vitalícia</strong>. A cada{" "}
            <strong>400 XP</strong> acumulados em qualquer atividade na DOC-Academy, você sobe um nível. Seu Nível e todo o
            XP acumulado <strong>nunca são zerados ou perdidos</strong>.
          </p>
        </div>
        <div className="panel" style={{ padding: 22, borderLeft: "4px solid #b7791f" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Medal size={20} style={{ color: "#b7791f" }} />
            <h3 style={{ fontSize: 15, margin: 0 }}>Como você sobe de FAIXA</h3>
          </div>
          <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.7, margin: 0 }}>
            A <strong>Faixa</strong> mede seu ritmo na <strong>temporada anual</strong>: Bronze (0 XP) → Prata (800 XP) →
            Ouro (2.000 XP) → Platina (3.500 XP) → Diamante (5.000 XP). Ela reflete suas reciclagens e participação no ano
            vigente.
          </p>
        </div>
        <div className="panel" style={{ padding: 22, borderLeft: "4px solid #319795" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Sparkles size={20} style={{ color: "#319795" }} />
            <h3 style={{ fontSize: 15, margin: 0 }}>Virada de Temporada e Reciclagem</h3>
          </div>
          <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.7, margin: 0 }}>
            Ao término da temporada anual, <strong>a sua faixa atual cairá duas categorias</strong> (exemplo: quem alcançou
            Diamante recomeça em Ouro; Platina em Prata; Ouro em Bronze). No entanto,{" "}
            <strong>seu Nível e todo o XP continuam 100% mantidos</strong>.
          </p>
        </div>
      </div>

      <div className="dashboard-bottom">
        <section>
          <SectionHeading
            title="Aprendizados que viram conquistas"
            description="Seus cursos concluídos, com ou sem avaliação."
          />
          {withoutQuiz.map((course) => (
            <div className="certificate-row" key={course.id}>
              <Award size={30} />
              <div>
                <strong>{course.title}</strong>
                <small>
                  Curso concluído · sem avaliação · versão {course.version}
                </small>
              </div>
            </div>
          ))}
          {approved.length ? (
            approved.map((attempt) => (
              <div className="certificate-row" key={attempt.id}>
                <Award size={30} />
                <div>
                  <strong>{attempt.courseTitle}</strong>
                  <small>
                    Aprovado com {attempt.score}% · versão {attempt.courseVersion}
                    <br />
                    Aprovação registrada · emissão de certificado em preparação
                  </small>
                </div>
              </div>
            ))
          ) : withoutQuiz.length ? null : (
            <EmptyState
              icon={<Award size={30} />}
              title="Sua primeira conquista está por vir."
              description="Conclua as aulas e, quando houver avaliação, obtenha a aprovação para ver seu registro aqui."
            >
              <Button asChild variant="secondary">
                <Link href="/aprender">
                  Encontrar minha próxima jornada <ArrowRight size={15} />
                </Link>
              </Button>
            </EmptyState>
          )}
        </section>
        <section className="panel ranking-card">
          <SectionHeading
            title="Evoluímos melhor juntos"
            description="Ranking anual · XP de aulas, acertos e conclusões"
          />
          {people.map((person, index) => (
            <div
              className="ranking-row"
              key={person.id}
              style={
                person.id === me.id
                  ? { background: "var(--lavender)", margin: "0 -10px", padding: "10px", borderRadius: 8 }
                  : undefined
              }
            >
              <span className={`rank-position rank-${index + 1}`}>
                {index === 0 ? <Trophy size={15} /> : String(index + 1).padStart(2, "0")}
              </span>
              <span className={`avatar avatar-${index % 5}`}>{initials(person.name)}</span>
              <span className="ranking-name">
                <strong>{person.name}{person.id === me.id ? " · você" : ""}</strong>
                <small>{person.department}</small>
              </span>
              <span className="ranking-xp">
                {number(person.xp)} <small>XP</small>
              </span>
            </div>
          ))}
        </section>
      </div>

      <div className="info-note section-space">
        <Sparkles size={16} style={{ display: "inline", verticalAlign: "middle" }} /> Seu histórico permanece. Cada nova
        temporada oferece uma nova jornada. O fechamento anual e as reciclagens serão implementados na etapa de
        gamificação.
      </div>

      <ProfilePhotoModal isOpen={isPhotoModalOpen} onClose={() => setIsPhotoModalOpen(false)} />
      <PasswordChangeModal isOpen={isPasswordModalOpen} onClose={() => setIsPasswordModalOpen(false)} />
    </div>
  );
}
