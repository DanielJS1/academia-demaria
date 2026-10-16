"use client";

import { useState } from "react";
import { isCourseComplete } from "@/lib/rewards";
import Link from "next/link";
import { ArrowRight, Award, CalendarDays, Camera, ChevronLeft, ChevronRight, Flame, Gem, KeyRound, Medal, Shield, Sparkles, Trash2, Trophy } from "lucide-react";
import { useAcademy } from "./academy-provider";
import { Button } from "./ui/button";
import { EmptyState, PageHeading, Progress, SectionHeading } from "./shared";
import { experience, tiers, DEMO_SEASON, tierClass } from "@/lib/gamification";
import { initials, number } from "@/lib/utils";
import { ProfilePhotoModal } from "./profile-photo-modal";
import { PasswordChangeModal } from "./password-change-modal";

export function Evolution() {
  const { state, me, avatar, setAvatar, notify } = useAcademy();
  const xp = experience(state);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [rankingPage, setRankingPage] = useState(1);
  const [achievementsPage, setAchievementsPage] = useState(1);

  const people = state.people
    .filter((person) => person.status === "active" && person.audience !== "client")
    .map((person) => (person.id === me.id ? { ...person, xp: xp.annual } : person))
    .sort((a, b) => b.xp - a.xp);
  const rankingPages = Math.max(1, Math.ceil(people.length / 5));
  const currentPage = Math.min(rankingPage, rankingPages);
  const visiblePeople = people.slice((currentPage - 1) * 5, currentPage * 5);

  const approved = [...state.attempts].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)).filter(
    (attempt, index, attempts) =>
      attempt.status === "approved" &&
      attempt.userId === me.id &&
      state.courses.some((c) => c.id === attempt.courseId && isCourseComplete(c, state, me.id)) &&
      attempts.findIndex(
        (item) => item.userId === me.id && item.courseId === attempt.courseId && item.status === "approved"
      ) === index
  );

  const withoutQuiz = state.courses.filter(
    (course) => !course.lessons.some((l) => l.type === "quiz") && isCourseComplete(course, state, me.id) && !approved.some((a) => a.courseId === course.id)
  );
  const completedAt = (courseId: string) => state.xpEvents.find(event => event.courseId === courseId && (event.eventKey === "completion" || event.eventKey === "legacy"))?.createdAt ?? "";
  const achievements = [
    ...state.recognitions.filter(item => item.userId === me.id).map(item => ({
      id: `recognition:${item.id}`, title: item.title, date: item.createdAt, recognition: true,
      subtitle: `Reconhecimento de liderança · ${new Date(item.createdAt).toLocaleDateString("pt-BR")} · Concedido por ${item.managerName}`,
      detail: item.message,
    })),
    ...withoutQuiz.map(course => ({
      id: `course:${course.id}`, title: course.title, date: completedAt(course.id), recognition: false,
      subtitle: `Curso concluído · sem avaliação · versão ${course.version}`, detail: "",
    })),
    ...approved.map(attempt => ({
      id: `attempt:${attempt.id}`, title: attempt.courseTitle, date: completedAt(attempt.courseId) || attempt.submittedAt, recognition: false,
      subtitle: `Aprovado com ${attempt.score}% · versão ${attempt.courseVersion}`,
      detail: attempt.quizId === "proficiency" || (attempt as any).snapshot?.proficiency
        ? "Aprovação por Prova de Proficiência · dispensa integral de aulas"
        : "Aprovação registrada · emissão de certificado em preparação",
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  const achievementsPages = Math.max(1, Math.ceil(achievements.length / 5));
  const currentAchievementsPage = Math.min(achievementsPage, achievementsPages);
  const visibleAchievements = achievements.slice((currentAchievementsPage - 1) * 5, currentAchievementsPage * 5);

  return (
    <div className="page-enter evolution-page">
      <PageHeading
        variant="compact"
        eyebrow="SEU CONHECIMENTO DEIXA MARCAS"
        title="Toda evolução conta."
        description="Acompanhe seu nível, sua faixa na temporada e suas conquistas."
      >
        <span className="season-pill">
          <span /> Temporada {DEMO_SEASON}
        </span>
      </PageHeading>

      <div className="evolution-top">
      {/* Painel de Gestão de Perfil, Foto e Senha Exclusiva */}
      <section className="evolution-profile-card" aria-label="Seu perfil">
        <div className="profile-card-left">
          <div className="profile-card-avatar-wrap">
            <div className={`profile-card-avatar tier-avatar ${tierClass(xp.annual)}`} title={`Faixa ${xp.tier.name}`}>
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
                <span>Remover foto</span>
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
      <section className="evolution-hero" aria-label="Sua trajetória">
        <span className="evolution-emblem">
          <Gem size={65} strokeWidth={1} />
        </span>
        <div>
          <div className="hero-eyebrow">SUA TRAJETÓRIA</div>
          <h2>Nível {xp.level} · Explorador</h2>
          <p>Seu nível considera todo o XP acumulado, em todas as temporadas.</p>
          <Progress value={xp.levelProgress} label="Progresso para o próximo nível" />
          <p className="evolution-next-level">{400 - (xp.total % 400)} XP para o próximo nível</p>
        </div>
        <div className="evolution-xp">
          <strong>
            {number(xp.total)} <small>XP</small>
          </strong>
          <small>experiência acumulada</small>
        </div>
      </section>
      </div>

      <SectionHeading
        title="Sua faixa nesta temporada"
        description={`Faixa atual: ${xp.tier.name} · ${number(xp.annual)} XP em ${DEMO_SEASON}`}
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

      <section className="evolution-guide" aria-label="Entenda como funciona sua evolução">
      <SectionHeading
        title="Entenda como funciona sua evolução"
        description="O nível acompanha seu histórico. A faixa acompanha o ano atual."
      />
      <div className="evolution-rules-grid">
        <article className="panel evolution-rule-card">
          <div className="evolution-rule-heading">
            <span className="evolution-rule-icon" aria-hidden="true"><Gem size={22} /></span>
            <h3>Nível</h3>
          </div>
          <p>
            É seu <strong>progresso acumulado</strong>. A cada <strong>400 XP</strong> conquistados,
            você sobe um nível. Ele continua na virada do ano.
          </p>
        </article>
        <article className="panel evolution-rule-card">
          <div className="evolution-rule-heading">
            <span className="evolution-rule-icon" aria-hidden="true"><Medal size={22} /></span>
            <h3>Faixa</h3>
          </div>
          <p>
            Mostra seu <strong>progresso no ano</strong>, de Bronze a Diamante.
            Depende do XP da temporada atual. Veja as faixas e os pontos necessários logo acima.
          </p>
        </article>
        <article className="panel evolution-rule-card">
          <div className="evolution-rule-heading">
            <span className="evolution-rule-icon" aria-hidden="true"><CalendarDays size={22} /></span>
            <h3>Temporada</h3>
          </div>
          <p>
            Vai de <strong>janeiro a dezembro</strong>. No novo ano, a faixa considera o XP da nova temporada.
            Seu nível e suas conquistas continuam no histórico.
          </p>
        </article>
      </div>
      </section>

      <div className="dashboard-bottom">
        <section className="panel ranking-card achievements-card">
          <SectionHeading
            title="Aprendizados que viram conquistas"
            description="Seus cursos concluídos, com ou sem avaliação."
          />
          <div id="achievements-list" className="achievements-list" role="region" aria-label="Histórico de conquistas">
            {visibleAchievements.map(item => (
              <article className={`certificate-row ${item.recognition ? "leadership-recognition" : ""}`} key={item.id}>
                {item.recognition ? <Medal size={30} aria-hidden="true" /> : <Award size={30} aria-hidden="true" />}
                <div>
                  <strong>{item.title}</strong>
                  <small>{item.subtitle}</small>
                  {item.detail && (item.recognition ? <p>{item.detail}</p> : <small>{item.detail}</small>)}
                </div>
                {item.recognition && <span className="recognition-xp">+100 XP</span>}
              </article>
            ))}
          </div>
          {achievementsPages > 1 && <nav className="ranking-pagination" aria-label="Páginas das conquistas"><Button type="button" variant="secondary" size="sm" disabled={currentAchievementsPage === 1} onClick={() => setAchievementsPage(currentAchievementsPage - 1)} aria-label="Página anterior"><ChevronLeft size={16} /></Button><span aria-live="polite">Página {currentAchievementsPage} de {achievementsPages}</span><Button type="button" variant="secondary" size="sm" disabled={currentAchievementsPage === achievementsPages} onClick={() => setAchievementsPage(currentAchievementsPage + 1)} aria-label="Próxima página"><ChevronRight size={16} /></Button></nav>}
          {!achievements.length && (
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
        <section className="panel ranking-card" id="ranking">
          <SectionHeading
            title="Evoluímos melhor juntos"
            description="Ranking anual · XP de aulas, acertos e conclusões"
          />
          {visiblePeople.map((person, index) => {
            const rank = (currentPage - 1) * 5 + index + 1;
            return (
            <div
              className="ranking-row"
              key={person.id}
              style={
                person.id === me.id
                  ? { background: "var(--lavender)", margin: "0 -10px", padding: "10px", borderRadius: 8 }
                  : undefined
              }
            >
              <span className={`rank-position rank-${rank}`}>
                {rank === 1 ? <Trophy size={15} /> : String(rank).padStart(2, "0")}
              </span>
              {(() => {
                const personAvatar = person.avatar || (person.id === me.id ? avatar : undefined);
                return (
                  <span className={`avatar avatar-${index % 5} tier-avatar ${tierClass(person.xp)}`} title={`Faixa ${tierClass(person.xp).slice(5)}`} style={{ padding: 0 }}>
                    {personAvatar ? <img src={personAvatar} alt={person.name} className="avatar-img" /> : initials(person.name)}
                  </span>
                );
              })()}
              <span className="ranking-name">
                <strong>{person.name}{person.id === me.id ? " · você" : ""}</strong>
                <small>{person.department}</small>
                <small className="ranking-details"><span><Flame size={12} /> Ofensiva: {person.streak ?? 0} {person.streak === 1 ? "dia" : "dias"}</span><span>Desempenho: {person.performance ?? person.progress}% das aulas</span></small>
              </span>
              <span className="ranking-xp">
                {number(person.xp)} <small>XP</small>
              </span>
            </div>
          );})}
          {rankingPages > 1 && <nav className="ranking-pagination" aria-label="Páginas do ranking"><Button type="button" variant="secondary" size="sm" disabled={currentPage === 1} onClick={() => setRankingPage(currentPage - 1)} aria-label="Página anterior"><ChevronLeft size={16} /></Button><span aria-live="polite">Página {currentPage} de {rankingPages}</span><Button type="button" variant="secondary" size="sm" disabled={currentPage === rankingPages} onClick={() => setRankingPage(currentPage + 1)} aria-label="Próxima página"><ChevronRight size={16} /></Button></nav>}
        </section>
      </div>

      <div className="info-note section-space">
        <Sparkles size={16} style={{ display: "inline", verticalAlign: "middle" }} aria-hidden="true" /> Seu XP acumulado e suas conquistas continuam no histórico entre temporadas.
      </div>

      <ProfilePhotoModal isOpen={isPhotoModalOpen} onClose={() => setIsPhotoModalOpen(false)} />
      <PasswordChangeModal isOpen={isPasswordModalOpen} onClose={() => setIsPasswordModalOpen(false)} />
    </div>
  );
}
