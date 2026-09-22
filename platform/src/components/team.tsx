"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Award,
  BarChart3,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Download,
  Eye,
  FileText,
  Filter,
  GraduationCap,
  Layers,
  Search,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { useAcademy } from "./academy-provider";
import { Button } from "./ui/button";
import { CourseArt, EmptyState, PageHeading, Progress } from "./shared";
import { csvCell, initials, normalize } from "@/lib/utils";
import { courseProgress, minutes, type Attempt, type Course, type Person } from "@/lib/model";
import { formatActiveTime, formatLastAccess, type EngagementMember } from "@/lib/engagement";
import { EngagementControls, MemberEngagement, useTeamEngagement } from "./team-engagement";

// Determina se o curso é voltado especificamente para o departamento do colaborador
function isCourseForSector(course: Course, department: string): boolean {
  if (!department) return false;
  if (course.department && course.department.trim()) {
    return normalize(course.department) === normalize(department);
  }
  const normDept = normalize(department);
  const normCat = normalize(course.category || "");
  const normProd = normalize(course.product || "");
  if (normCat === normDept || normProd === normDept) return true;
  if (normDept.includes("desenvolvimento") && normCat.includes("desenvolvimento")) return true;
  if (normDept.includes("comercial") && (normCat.includes("comercial") || normProd.includes("comercial"))) return true;
  if (normDept.includes("financeiro") && (normCat.includes("financeiro") || normProd.includes("financeiro"))) return true;
  if (normDept.includes("suporte") && (normCat.includes("suporte") || normProd.includes("suporte"))) return true;
  return false;
}

// Retorna as aulas concluídas de um colaborador em um curso específico
function getCompletedLessonIds(
  personId: string,
  courseId: string,
  teamProgress: Record<string, Record<string, string[]>> | undefined,
  currentUserId: string,
  completedMap: Record<string, string[]>
): string[] {
  if (teamProgress?.[personId]?.[courseId]) {
    return teamProgress[personId][courseId];
  }
  if (personId === currentUserId && completedMap[courseId]) {
    return completedMap[courseId];
  }
  return [];
}

// Analisa os acertos e erros de uma tentativa de avaliação
function analyzeAttempt(attempt: Attempt): {
  totalQuestions: number;
  correctCount: number;
  errorCount: number;
  questionDetails: Array<{
    id: string;
    prompt: string;
    type: "choice" | "text";
    userAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
  }>;
} {
  const formatAnswer = (val: string) => {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed.join(" · ");
    } catch {}
    return val;
  };

  const details = attempt.questions.map(question => {
    const rawAnswer = attempt.answers[question.id] || "Sem resposta";
    let isCorrect = false;

    if (question.type === "choice") {
      isCorrect = Boolean(question.correct && normalize(rawAnswer) === normalize(question.correct));
    } else {
      isCorrect = Boolean(attempt.correctTextIds?.includes(question.id));
    }

    return {
      id: question.id,
      prompt: question.prompt,
      type: question.type,
      userAnswer: formatAnswer(rawAnswer),
      correctAnswer: formatAnswer(question.correct) || (question.type === "text" ? "Avaliado pelo gestor/admin" : ""),
      isCorrect,
    };
  });

  const correctCount = details.filter(d => d.isCorrect).length;
  const errorCount = details.length - correctCount;

  return {
    totalQuestions: details.length,
    correctCount,
    errorCount,
    questionDetails: details,
  };
}

export function Team() {
  const { state, me, notify, isClientEnvironment } = useAcademy();
  const engagement = useTeamEngagement(me.id, !isClientEnvironment && me.role !== "student");
  const [activeTab, setActiveTab] = useState<"people" | "courses" | "assessments">("people");
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "pending">("all");
  const [progressFilter, setProgressFilter] = useState<"all" | "not_started" | "in_progress" | "completed" | "at_risk">("all");
  const [sortBy, setSortBy] = useState<"last_access" | "frequency" | "active_time" | "progress_desc" | "progress_asc" | "xp_desc" | "name_asc">("last_access");

  // Colaborador e tentativa selecionados para modais
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [selectedAttempt, setSelectedAttempt] = useState<Attempt | null>(null);

  // Filtra pessoas monitoradas por este usuário (Admin vê todos; Gestor vê quem tem seu managerId ou do seu mesmo setor)
  const currentDept = me.department || state.people.find(p => p.id === me.id)?.department || "";
  const people = useMemo(() => {
    return state.people.filter(
      person =>
        (me.role === "admin" ||
          person.managerId === me.id ||
          (me.role === "manager" && !person.managerId && currentDept && person.department.trim().toLowerCase() === currentDept.trim().toLowerCase())) &&
        person.id !== me.id &&
        person.audience !== "client" &&
        person.status !== "inactive"
    );
  }, [state.people, me.role, me.id, currentDept]);

  const publishedCourses = useMemo(() => {
    return state.courses.filter(c => c.status === "published");
  }, [state.courses]);

  // Total de conteúdos (aulas práticas e teóricas) disponibilizados no catálogo
  const totalAvailableLessons = useMemo(() => {
    return publishedCourses.reduce((sum, c) => sum + c.lessons.filter(l => l.type !== "quiz").length, 0);
  }, [publishedCourses]);

  // Lista de tentativas da equipe
  const teamAttempts = useMemo(() => {
    const peopleIds = new Set(people.map(p => p.id));
    return state.attempts.filter(a => a.userId && peopleIds.has(a.userId));
  }, [state.attempts, people]);

  // Métricas agregadas por colaborador
  const peopleMetrics = useMemo(() => {
    const map = new Map<
      string,
      {
        watchedCount: number;
        watchedPercent: number;
        studyMinutes: number;
        sectorTotal: number;
        sectorCompleted: number;
        sectorPercent: number;
        attemptsCount: number;
        averageScore: number;
      }
    >();

    for (const person of people) {
      let watchedCount = 0;
      let studyMinutes = 0;
      let sectorTotal = 0;
      let sectorCompleted = 0;

      for (const course of publishedCourses) {
        const completedIds = getCompletedLessonIds(
          person.id,
          course.id,
          state.teamProgress,
          me.id,
          state.completed
        );
        const validCompleted = course.lessons.filter(
          l => l.type !== "quiz" && completedIds.includes(l.id)
        );
        watchedCount += validCompleted.length;
        studyMinutes += validCompleted.reduce((sum, l) => sum + l.minutes, 0);

        const isSector = isCourseForSector(course, person.department);
        if (isSector) {
          sectorTotal += 1;
          const courseProg = courseProgress(course, completedIds);
          if (courseProg === 100) sectorCompleted += 1;
        }
      }

      const watchedPercent =
        totalAvailableLessons > 0 ? Math.round((watchedCount / totalAvailableLessons) * 100) : 0;
      const sectorPercent =
        sectorTotal > 0 ? Math.round((sectorCompleted / sectorTotal) * 100) : 100;

      const personAttempts = teamAttempts.filter(a => a.userId === person.id && a.score !== null);
      const averageScore =
        personAttempts.length > 0
          ? Math.round(
              personAttempts.reduce((sum, a) => sum + (a.score || 0), 0) / personAttempts.length
            )
          : 0;

      map.set(person.id, {
        watchedCount,
        watchedPercent,
        studyMinutes,
        sectorTotal,
        sectorCompleted,
        sectorPercent,
        attemptsCount: personAttempts.length,
        averageScore,
      });
    }

    return map;
  }, [people, publishedCourses, totalAvailableLessons, state.teamProgress, me.id, state.completed, teamAttempts]);

  // Estatísticas Globais do Dashboard (Team Pulse)
  const teamStats = useMemo(() => {
    if (!people.length) {
      return {
        totalPeople: 0,
        avgProgress: 0,
        totalWatched: 0,
        totalPossible: 0,
        watchedRate: 0,
        totalSectorAssigned: 0,
        totalSectorDone: 0,
        sectorRate: 0,
        avgScore: 0,
        totalHours: 0,
      };
    }

    let totalProgressSum = 0;
    let totalWatched = 0;
    let totalSectorAssigned = 0;
    let totalSectorDone = 0;
    let totalMinutes = 0;
    let scoreSum = 0;
    let scoreCount = 0;

    for (const person of people) {
      totalProgressSum += person.progress;
      const m = peopleMetrics.get(person.id);
      if (m) {
        totalWatched += m.watchedCount;
        totalSectorAssigned += m.sectorTotal;
        totalSectorDone += m.sectorCompleted;
        totalMinutes += m.studyMinutes;
        if (m.attemptsCount > 0) {
          scoreSum += m.averageScore * m.attemptsCount;
          scoreCount += m.attemptsCount;
        }
      }
    }

    const totalPossible = totalAvailableLessons * people.length;
    const watchedRate = totalPossible > 0 ? Math.round((totalWatched / totalPossible) * 100) : 0;
    const sectorRate =
      totalSectorAssigned > 0 ? Math.round((totalSectorDone / totalSectorAssigned) * 100) : 100;
    const avgScore = scoreCount > 0 ? Math.round(scoreSum / scoreCount) : 0;
    const avgProgress = Math.round(totalProgressSum / people.length);
    const totalHours = Math.round((totalMinutes / 60) * 10) / 10;

    return {
      totalPeople: people.length,
      avgProgress,
      totalWatched,
      totalPossible,
      watchedRate,
      totalSectorAssigned,
      totalSectorDone,
      sectorRate,
      avgScore,
      totalHours,
    };
  }, [people, totalAvailableLessons, peopleMetrics]);

  // Filtros aplicados na lista de colaboradores
  const filteredPeople = useMemo(() => {
    return people
      .filter(person => {
        const matchesSearch = normalize(
          `${person.name} ${person.email} ${person.department}`
        ).includes(normalize(search));
        const matchesDept =
          departmentFilter === "all" || person.department === departmentFilter;
        const matchesStatus =
          statusFilter === "all" || person.status === statusFilter;

        let matchesProgress = true;
        if (progressFilter === "not_started") matchesProgress = person.progress === 0;
        else if (progressFilter === "in_progress")
          matchesProgress = person.progress > 0 && person.progress < 100;
        else if (progressFilter === "completed") matchesProgress = person.progress === 100;
        else if (progressFilter === "at_risk") matchesProgress = person.progress < 30;

        return matchesSearch && matchesDept && matchesStatus && matchesProgress;
      })
      .sort((a, b) => {
        const first = engagement.members.get(a.id), second = engagement.members.get(b.id);
        if (sortBy === "last_access") return (second?.lastAccessAt ?? "").localeCompare(first?.lastAccessAt ?? "");
        if (sortBy === "frequency") return (second?.activeDays ?? -1) - (first?.activeDays ?? -1);
        if (sortBy === "active_time") return (second?.activeSeconds ?? -1) - (first?.activeSeconds ?? -1);
        if (sortBy === "progress_desc") return b.progress - a.progress;
        if (sortBy === "progress_asc") return a.progress - b.progress;
        if (sortBy === "xp_desc") return b.xp - a.xp;
        if (sortBy === "name_asc") return a.name.localeCompare(b.name, "pt-BR");
        return 0;
      });
  }, [people, search, departmentFilter, statusFilter, progressFilter, sortBy, engagement.members]);

  // Lista de departamentos presentes na equipe para filtro
  const availableDepartments = useMemo(() => {
    const set = new Set(people.map(p => p.department).filter(Boolean));
    return Array.from(set).sort();
  }, [people]);

  // Exportação CSV do Relatório Geral Consolidado
  const exportGeneralReport = () => {
    const headers = [
      "Nome",
      "E-mail",
      "Departamento",
      "Papel",
      "Status",
      "Progresso Geral (%)",
      "Conteúdos Assistidos",
      "Total de Conteúdos do Catálogo",
      "Taxa de Absorção (%)",
      "Último Acesso (Brasília)",
      `Dias com Acesso (${engagement.days} dias)`,
      `Tempo Ativo em Minutos (${engagement.days} dias)`,
      "Início da Coleta de Presença",
      "Total Avaliações",
      "Média em Avaliações (%)",
      "Horas Estimadas das Aulas Concluídas",
      "XP da Temporada",
    ];

    const rows = filteredPeople.map(person => {
      const m = peopleMetrics.get(person.id);
      const presence = engagement.members.get(person.id);
      return [
        person.name,
        person.email,
        person.department,
        person.role === "manager" ? "Gestor" : person.role === "admin" ? "Administrador" : "Colaborador",
        person.status === "active" ? "Ativo" : "Pendente",
        person.progress,
        m?.watchedCount || 0,
        totalAvailableLessons,
        m?.watchedPercent || 0,
        engagement.data ? formatLastAccess(presence?.lastAccessAt) : "Indisponível",
        presence ? presence.activeDays : "Sem registro",
        presence ? (presence.activeSeconds / 60).toFixed(1) : "Sem registro",
        engagement.data ? formatLastAccess(engagement.data.collectedSince) : "Indisponível",
        m?.attemptsCount || 0,
        m?.averageScore || 0,
        m ? (m.studyMinutes / 60).toFixed(1) : "0.0",
        person.xp,
      ].map(csvCell);
    });

    const lines = [headers.map(csvCell).join(";"), ...rows.map(r => r.join(";"))];
    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `relatorio-equipe-doc-academy-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("Relatório consolidado exportado com sucesso.");
  };

  // Exportação CSV do Relatório de Avaliações
  const exportAssessmentsReport = () => {
    const headers = [
      "Data de Envio",
      "Colaborador",
      "E-mail",
      "Departamento",
      "Curso",
      "Versão",
      "Nota Obtida (%)",
      "Nota Mínima (%)",
      "Situação",
      "Total Questões",
      "Acertos",
      "Erros",
      "Feedback do Gestor",
    ];

    const rows = teamAttempts.map(attempt => {
      const person = people.find(p => p.id === attempt.userId);
      const analysis = analyzeAttempt(attempt);
      return [
        new Date(attempt.submittedAt).toLocaleDateString("pt-BR"),
        person?.name || "Colaborador",
        person?.email || "",
        person?.department || "",
        attempt.courseTitle,
        attempt.courseVersion,
        attempt.score ?? "Pendente",
        attempt.passingScore,
        attempt.status === "approved" ? "Aprovado" : attempt.status === "retry" ? "Nova tentativa" : "Aguardando correção",
        analysis.totalQuestions,
        analysis.correctCount,
        analysis.errorCount,
        attempt.feedback || "",
      ].map(csvCell);
    });

    const lines = [headers.map(csvCell).join(";"), ...rows.map(r => r.join(";"))];
    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `avaliacoes-equipe-doc-academy-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("Relatório de avaliações exportado com sucesso.");
  };

  return (
    <div className="page-enter">
      {/* Cabeçalho */}
      <PageHeading
        eyebrow="INTELIGÊNCIA DE TREINAMENTO & EQUIPE"
        title="Gestão de Talentos & Aprendizado"
        description="Acompanhe acessos, constância e aprendizado para orientar o PDI da sua equipe."
      >
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Button variant="secondary" onClick={exportGeneralReport}>
            <Download size={15} /> Relatório Geral (CSV)
          </Button>
          <Button variant="secondary" onClick={exportAssessmentsReport}>
            <Download size={15} /> Avaliações & Erros (CSV)
          </Button>
        </div>
      </PageHeading>

      {/* Banner de Contexto para Gestores */}
      {me.role === "manager" && (
        <div
          style={{
            margin: "-8px 0 20px",
            padding: "10px 16px",
            borderRadius: 8,
            background: currentDept ? "var(--surface-sunken, rgba(99, 102, 241, 0.08))" : "rgba(239, 68, 68, 0.08)",
            border: `1px solid ${currentDept ? "var(--primary-subtle, rgba(99, 102, 241, 0.2))" : "rgba(239, 68, 68, 0.25)"}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 10,
            fontSize: 13,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Users size={16} style={{ color: currentDept ? "var(--primary)" : "#ef4444" }} />
            <span>
              {currentDept ? (
                <>
                  Gestão focada no setor <strong>{currentDept}</strong> ({people.length} colaborador(es) localizado(s)).
                </>
              ) : (
                <>
                  <strong>Atenção:</strong> Seu perfil de Gestor ainda não tem um setor definido. Solicite a um administrador para definir seu departamento em <em>Administração &gt; Pessoas</em>.
                </>
              )}
            </span>
          </div>
          {currentDept && (
            <span style={{ fontSize: 11, color: "var(--muted)" }}>
              Colaboradores do setor {currentDept} ou atribuídos a você aparecem nesta tela automaticamente.
            </span>
          )}
        </div>
      )}

      <EngagementControls report={engagement} />

      {/* Grid de Métricas Principais (Team Pulse) */}
      <div className="team-stats-grid">
        {/* Card 1: Pessoas */}
        <section className="panel team-stat-card">
          <div className="team-stat-header">
            <span>Pessoas na Equipe</span>
            <div className="team-stat-icon">
              <Users size={17} />
            </div>
          </div>
          <div>
            <div className="team-stat-value">{teamStats.totalPeople}</div>
            <div className="team-stat-footer">
              <span>{people.filter(p => p.progress > 0 && p.progress < 100).length} em desenvolvimento</span>
              <span className="team-badge green">{teamStats.avgProgress}% progresso médio</span>
            </div>
          </div>
        </section>

        {/* Card 2: Conteúdos Assistidos X Disponibilizados */}
        <section className="panel team-stat-card">
          <div className="team-stat-header">
            <span>Conteúdos Assistidos X Catálogo</span>
            <div className="team-stat-icon blue">
              <BookOpen size={17} />
            </div>
          </div>
          <div>
            <div className="team-stat-value">{teamStats.watchedRate}%</div>
            <div className="team-stat-footer">
              <span>
                <strong>{teamStats.totalWatched}</strong> de {teamStats.totalPossible} aulas concluídas
              </span>
              <span>{totalAvailableLessons} aulas totais</span>
            </div>
            <div className="team-stat-bar blue">
              <div style={{ width: `${teamStats.watchedRate}%` }} />
            </div>
          </div>
        </section>

        {/* Card 3: Frequência real no período */}
        <section className="panel team-stat-card">
          <div className="team-stat-header">
            <span>Equipe com acesso · {engagement.days} dias</span>
            <div className="team-stat-icon green">
              <Target size={17} />
            </div>
          </div>
          <div>
            <div className="team-stat-value">{engagement.data ? engagement.data.members.filter(member => member.activeDays > 0).length : "—"}</div>
            <div className="team-stat-footer">
              <span>
                de {engagement.data?.members.length ?? "—"} colaboradores ativos
              </span>
              <span className="team-badge primary">Presença</span>
            </div>
          </div>
        </section>

        {/* Card 4: Desempenho em Avaliações */}
        <section className="panel team-stat-card">
          <div className="team-stat-header">
            <span>Desempenho em Provas</span>
            <div className="team-stat-icon amber">
              <Award size={17} />
            </div>
          </div>
          <div>
            <div className="team-stat-value">{teamStats.avgScore > 0 ? `${teamStats.avgScore}%` : "—"}</div>
            <div className="team-stat-footer">
              <span>{teamAttempts.length} avaliações enviadas</span>
              <span className="team-badge green">
                {teamAttempts.filter(a => a.status === "approved").length} aprovadas
              </span>
            </div>
          </div>
        </section>

        {/* Card 5: Tempo de atividade registrado */}
        <section className="panel team-stat-card">
          <div className="team-stat-header">
            <span>Tempo ativo · {engagement.days} dias</span>
            <div className="team-stat-icon">
              <Clock3 size={17} />
            </div>
          </div>
          <div>
            <div className="team-stat-value">{engagement.data ? formatActiveTime(engagement.data.members.reduce((sum, member) => sum + member.activeSeconds, 0)) : "—"}</div>
            <div className="team-stat-footer">
              <span>Estimativa de uso em foco</span>
              <span>Sem pausas prolongadas</span>
            </div>
          </div>
        </section>
      </div>

      {/* Abas de Navegação dos Relatórios */}
      <div className="tabs">
        <button
          type="button"
          className={activeTab === "people" ? "selected" : ""}
          onClick={() => setActiveTab("people")}
        >
          <Users size={16} /> Visão por Colaborador ({filteredPeople.length})
        </button>
        <button
          type="button"
          className={activeTab === "courses" ? "selected" : ""}
          onClick={() => setActiveTab("courses")}
        >
          <Layers size={16} /> Desempenho por Curso ({publishedCourses.length})
        </button>
        <button
          type="button"
          className={activeTab === "assessments" ? "selected" : ""}
          onClick={() => setActiveTab("assessments")}
        >
          <GraduationCap size={16} /> Avaliações & Diagnóstico de Erros ({teamAttempts.length})
        </button>
      </div>

      {/* -------------------------------------------------------------
          ABA 1: COLABORADORES
          ------------------------------------------------------------- */}
      {activeTab === "people" && (
        <div>
          {/* Barra de Filtros */}
          <div className="team-toolbar">
            <div className="field-search" style={{ minWidth: 260 }}>
              <Search size={17} />
              <input
                aria-label="Buscar pessoa na minha equipe"
                placeholder="Buscar por nome, e-mail ou setor..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {/* Filtro de Setor */}
            {availableDepartments.length > 1 && (
              <div className="team-select-field">
                <Filter size={14} />
                <select
                  value={departmentFilter}
                  onChange={e => setDepartmentFilter(e.target.value)}
                  aria-label="Filtrar por departamento"
                >
                  <option value="all">Todos os setores</option>
                  {availableDepartments.map(dept => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Filtro de Progresso */}
            <div className="team-select-field">
              <span>Progresso:</span>
              <select
                value={progressFilter}
                onChange={e => setProgressFilter(e.target.value as any)}
                aria-label="Filtrar por nível de progresso"
              >
                <option value="all">Todos os progressos</option>
                <option value="in_progress">Em andamento (1% a 99%)</option>
                <option value="completed">Concluídos (100%)</option>
                <option value="not_started">Sem início (0%)</option>
                <option value="at_risk">Atenção (&lt; 30%)</option>
              </select>
            </div>

            {/* Ordenação */}
            <div className="team-select-field" style={{ marginLeft: "auto" }}>
              <span>Ordenar por:</span>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                aria-label="Ordenar colaboradores"
              >
                <option value="last_access">Acesso mais recente</option>
                <option value="frequency">Mais dias com acesso</option>
                <option value="active_time">Maior tempo ativo</option>
                <option value="progress_desc">Maior progresso</option>
                <option value="progress_asc">Menor progresso</option>
                <option value="xp_desc">Mais XP na temporada</option>
                <option value="name_asc">Nome (A - Z)</option>
              </select>
            </div>
          </div>

          {/* Tabela de Pessoas */}
          {filteredPeople.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>COLABORADOR</th>
                    <th>DEPARTAMENTO</th>
                    <th>ÚLTIMO ACESSO</th>
                    <th>FREQUÊNCIA · {engagement.days} DIAS</th>
                    <th>TEMPO ATIVO · {engagement.days} DIAS</th>
                    <th>PROGRESSO GERAL</th>
                    <th>PROVAS / MÉDIA</th>
                    <th>EXPERIÊNCIA</th>
                    <th style={{ textAlign: "right" }}>AÇÃO</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPeople.map(person => {
                    const m = peopleMetrics.get(person.id);
                    const presence = engagement.members.get(person.id);
                    return (
                      <tr
                        key={person.id}
                        className="clickable-row"
                        onClick={() => setSelectedPerson(person)}
                        title="Clique para ver o relatório completo deste colaborador"
                      >
                        <td>
                          <div className="team-person-cell">
                            <span className="team-avatar" style={{ overflow: "hidden", padding: 0 }}>{person.avatar ? <img src={person.avatar} alt={person.name} className="avatar-img" /> : initials(person.name)}</span>
                            <div className="team-person-info">
                              <strong>{person.name}</strong>
                              <small>{person.email}</small>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="team-badge">{person.department}</span>
                        </td>
                        <td>
                          <span className="team-presence-value">{engagement.loading ? "Carregando…" : engagement.error ? "Indisponível" : formatLastAccess(presence?.lastAccessAt)}</span>
                        </td>
                        <td>
                          <span className="team-presence-value">{presence ? `${presence.activeDays} de ${engagement.days} dias` : "—"}</span>
                        </td>
                        <td>
                          <span className="team-presence-value">{presence ? formatActiveTime(presence.activeSeconds) : "—"}</span>
                        </td>
                        <td>
                          <div className="team-progress-cell">
                            <div className="team-progress-meta">
                              <span>{person.progress}%</span>
                              <small style={{ color: "var(--muted)" }}>
                                {person.progress === 100
                                  ? "Concluído"
                                  : person.progress === 0
                                  ? "Não iniciado"
                                  : "Em curso"}
                              </small>
                            </div>
                            <Progress value={person.progress} label={`Progresso de ${person.name}`} />
                          </div>
                        </td>
                        <td>
                          {m && m.attemptsCount > 0 ? (
                            <div>
                              <strong style={{ color: m.averageScore >= 70 ? "#10b981" : "#ef4444" }}>
                                {m.averageScore}%
                              </strong>
                              <small>{m.attemptsCount} avaliação(ões)</small>
                            </div>
                          ) : (
                            <span style={{ color: "var(--muted)", fontSize: 11 }}>Sem avaliações</span>
                          )}
                        </td>
                        <td>
                          <strong>{person.xp.toLocaleString("pt-BR")} XP</strong>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={e => {
                              e.stopPropagation();
                              setSelectedPerson(person);
                            }}
                          >
                            <Eye size={14} /> Ver Perfil
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={<Users size={28} />}
              title="Nenhum colaborador encontrado"
              description={
                people.length === 0
                  ? me.role === "manager"
                    ? currentDept
                      ? `Nenhum colaborador foi vinculado ao setor "${currentDept}" ou atribuído diretamente à sua gestão. Um administrador pode atribuir colaboradores em Administração > Pessoas.`
                      : "Seu perfil de Gestor ainda não possui um setor definido. Solicite a um administrador para definir seu departamento em Administração > Pessoas."
                    : "Nenhum colaborador cadastrado no sistema além do seu próprio perfil."
                  : "Ajuste os filtros de busca, departamento ou nível de progresso para visualizar sua equipe."
              }
            />
          )}
        </div>
      )}

      {/* -------------------------------------------------------------
          ABA 2: DESEMPENHO POR CURSO (Matriz LMS)
          ------------------------------------------------------------- */}
      {activeTab === "courses" && (
        <TeamCoursesView
          courses={publishedCourses}
          people={people}
          teamProgress={state.teamProgress}
          currentUserId={me.id}
          completedMap={state.completed}
          attempts={teamAttempts}
          onSelectPerson={setSelectedPerson}
        />
      )}

      {/* -------------------------------------------------------------
          ABA 3: RELATÓRIO DE AVALIAÇÕES & DIAGNÓSTICO DE ERROS
          ------------------------------------------------------------- */}
      {activeTab === "assessments" && (
        <TeamAssessmentsView
          attempts={teamAttempts}
          people={people}
          courses={publishedCourses}
          onSelectAttempt={setSelectedAttempt}
        />
      )}

      {/* -------------------------------------------------------------
          MODAL 360° DO COLABORADOR
          ------------------------------------------------------------- */}
      {selectedPerson && (
        <CollaboratorModal
          person={selectedPerson}
          courses={publishedCourses}
          totalAvailableLessons={totalAvailableLessons}
          teamProgress={state.teamProgress}
          currentUserId={me.id}
          completedMap={state.completed}
          attempts={teamAttempts.filter(a => a.userId === selectedPerson.id)}
          engagement={engagement.members.get(selectedPerson.id)}
          engagementDays={engagement.days}
          engagementUnavailable={!engagement.data}
          onClose={() => setSelectedPerson(null)}
          onSelectAttempt={attempt => {
            setSelectedAttempt(attempt);
          }}
        />
      )}

      {/* -------------------------------------------------------------
          MODAL DE DETALHAMENTO DE PROVA / ERROS
          ------------------------------------------------------------- */}
      {selectedAttempt && (
        <AttemptDetailModal
          attempt={selectedAttempt}
          person={people.find(p => p.id === selectedAttempt.userId)}
          onClose={() => setSelectedAttempt(null)}
        />
      )}

      <div className="info-note" style={{ marginTop: 24 }}>
        Gestores visualizam o desempenho e relatórios detalhados dos colaboradores vinculados à sua equipe.
        Administradores acompanham a totalidade da organização.
      </div>
    </div>
  );
}

// ============================================================================
// SUB-VIEW: DESEMPENHO POR CURSO
// ============================================================================
function TeamCoursesView({
  courses,
  people,
  teamProgress,
  currentUserId,
  completedMap,
  attempts,
  onSelectPerson,
}: {
  courses: Course[];
  people: Person[];
  teamProgress: Record<string, Record<string, string[]>> | undefined;
  currentUserId: string;
  completedMap: Record<string, string[]>;
  attempts: Attempt[];
  onSelectPerson: (person: Person) => void;
}) {
  const [search, setSearch] = useState("");
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null);

  const filteredCourses = useMemo(() => {
    return courses.filter(c =>
      normalize(`${c.title} ${c.product} ${c.category} ${c.department || ""}`).includes(
        normalize(search)
      )
    );
  }, [courses, search]);

  return (
    <div>
      <div className="team-toolbar">
        <div className="field-search">
          <Search size={17} />
          <input
            placeholder="Buscar curso por título, produto ou assunto..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="team-courses-grid">
        {filteredCourses.map(course => {
          // Calcula adesão da equipe neste curso
          const membersStats = people.map(person => {
            const completedIds = getCompletedLessonIds(
              person.id,
              course.id,
              teamProgress,
              currentUserId,
              completedMap
            );
            const prog = courseProgress(course, completedIds);
            const personAttempt = attempts.find(
              a => a.userId === person.id && a.courseId === course.id
            );
            return {
              person,
              progress: prog,
              completedCount: completedIds.length,
              status:
                prog === 100
                  ? "Concluído"
                  : prog > 0
                  ? "Em andamento"
                  : "Não iniciado",
              score: personAttempt?.score,
            };
          });

          const startedCount = membersStats.filter(m => m.progress > 0).length;
          const completedCount = membersStats.filter(m => m.progress === 100).length;
          const avgProgress =
            membersStats.length > 0
              ? Math.round(
                  membersStats.reduce((sum, m) => sum + m.progress, 0) / membersStats.length
                )
              : 0;

          const courseAttempts = attempts.filter(a => a.courseId === course.id && a.score !== null);
          const avgScore =
            courseAttempts.length > 0
              ? Math.round(
                  courseAttempts.reduce((sum, a) => sum + (a.score || 0), 0) / courseAttempts.length
                )
              : null;

          const isExpanded = expandedCourseId === course.id;

          return (
            <section key={course.id} className="panel team-course-card">
              <div>
                <div className="team-course-card-top">
                  <div className="team-course-badge-icon">
                    <BookOpen size={20} />
                  </div>
                  <div className="team-course-title">
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                      <span className="team-badge">{course.product}</span>
                      {course.department && (
                        <span className="team-badge primary">Setor: {course.department}</span>
                      )}
                      <span className="team-badge">{course.level}</span>
                    </div>
                    <h3>{course.title}</h3>
                    <small style={{ color: "var(--muted)" }}>
                      {course.lessons.length} atividades · {minutes(course)} min
                    </small>
                  </div>
                </div>

                <div className="team-course-metrics-row" style={{ marginTop: 14 }}>
                  <div className="team-course-metric-item">
                    <small>Iniciaram</small>
                    <strong>
                      {startedCount} / {people.length}
                    </strong>
                  </div>
                  <div className="team-course-metric-item">
                    <small>Concluíram</small>
                    <strong style={{ color: completedCount > 0 ? "#10b981" : "inherit" }}>
                      {completedCount}
                    </strong>
                  </div>
                  <div className="team-course-metric-item">
                    <small>Média Prova</small>
                    <strong>{avgScore !== null ? `${avgScore}%` : "—"}</strong>
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 10,
                      fontWeight: 600,
                      marginBottom: 4,
                    }}
                  >
                    <span>Progresso Médio da Equipe</span>
                    <span>{avgProgress}%</span>
                  </div>
                  <Progress value={avgProgress} label={`Progresso da equipe em ${course.title}`} />
                </div>
              </div>

              {/* Botão de Expansão / Detalhamento por Aluno */}
              <div>
                <Button
                  size="sm"
                  variant="secondary"
                  style={{ width: "100%", justifyContent: "space-between" }}
                  onClick={() => setExpandedCourseId(isExpanded ? null : course.id)}
                >
                  <span>{isExpanded ? "Ocultar alunos" : "Ver status por colaborador"}</span>
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </Button>

                {isExpanded && (
                  <div
                    style={{
                      marginTop: 10,
                      padding: "10px 0 0",
                      borderTop: "1px solid var(--line)",
                      maxHeight: 200,
                      overflowY: "auto",
                    }}
                  >
                    {membersStats.map(item => (
                      <div
                        key={item.person.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "6px 4px",
                          fontSize: 11,
                          borderBottom: "1px solid var(--line)",
                          cursor: "pointer",
                        }}
                        onClick={() => onSelectPerson(item.person)}
                      >
                        <div>
                          <strong>{item.person.name}</strong>
                          <small style={{ display: "block", color: "var(--muted)", fontSize: 9 }}>
                            {item.person.department}
                          </small>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <span
                            className={`team-badge ${
                              item.progress === 100
                                ? "green"
                                : item.progress > 0
                                ? "amber"
                                : ""
                            }`}
                            style={{ fontSize: 9 }}
                          >
                            {item.progress}%
                          </span>
                          {item.score !== undefined && item.score !== null && (
                            <small
                              style={{
                                display: "block",
                                color: item.score >= 70 ? "#10b981" : "#ef4444",
                                fontWeight: 700,
                                fontSize: 9,
                              }}
                            >
                              Nota: {item.score}%
                            </small>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// SUB-VIEW: RELATÓRIO DE AVALIAÇÕES & ERROS
// ============================================================================
function TeamAssessmentsView({
  attempts,
  people,
  courses,
  onSelectAttempt,
}: {
  attempts: Attempt[];
  people: Person[];
  courses: Course[];
  onSelectAttempt: (attempt: Attempt) => void;
}) {
  const [statusFilter, setStatusFilter] = useState<"all" | "approved" | "retry" | "pending">("all");
  const [courseFilter, setCourseFilter] = useState("all");
  const [search, setSearch] = useState("");

  // Diagnóstico de Questões com Maior Índice de Erro (Skill Gaps)
  const skillGaps = useMemo(() => {
    const questionMistakes = new Map<string, { prompt: string; courseTitle: string; errorCount: number; totalCount: number }>();

    for (const attempt of attempts) {
      const analysis = analyzeAttempt(attempt);
      for (const q of analysis.questionDetails) {
        if (!q.isCorrect) {
          const existing = questionMistakes.get(q.id) || {
            prompt: q.prompt,
            courseTitle: attempt.courseTitle,
            errorCount: 0,
            totalCount: 0,
          };
          existing.errorCount += 1;
          existing.totalCount += 1;
          questionMistakes.set(q.id, existing);
        }
      }
    }

    return Array.from(questionMistakes.values())
      .sort((a, b) => b.errorCount - a.errorCount)
      .slice(0, 3);
  }, [attempts]);

  const filteredAttempts = useMemo(() => {
    return [...attempts]
      .reverse()
      .filter(attempt => {
        const person = people.find(p => p.id === attempt.userId);
        const matchesSearch = normalize(
          `${attempt.courseTitle} ${person?.name || ""} ${person?.department || ""}`
        ).includes(normalize(search));
        const matchesStatus = statusFilter === "all" || attempt.status === statusFilter;
        const matchesCourse = courseFilter === "all" || attempt.courseId === courseFilter;
        return matchesSearch && matchesStatus && matchesCourse;
      });
  }, [attempts, people, search, statusFilter, courseFilter]);

  return (
    <div>
      {/* Banner de Diagnóstico de Erros da Equipe */}
      {skillGaps.length > 0 && (
        <div className="team-skill-gap-banner">
          <div className="team-skill-gap-icon">
            <AlertCircle size={22} />
          </div>
          <div className="team-skill-gap-text">
            <h4>Diagnóstico de Dificuldades da Equipe (Pontos de Atenção)</h4>
            <p>
              Identificamos questões com maior taxa de erro nas avaliações recentes. Recomendamos que o
              gestor reforce esses tópicos em reuniões 1:1 ou alinhamentos de setor:
            </p>
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
              {skillGaps.map((gap, idx) => (
                <div
                  key={idx}
                  style={{
                    fontSize: 11,
                    background: "rgba(0,0,0,0.03)",
                    padding: "4px 8px",
                    borderRadius: 6,
                  }}
                >
                  <strong style={{ color: "var(--ink)" }}>{gap.courseTitle}:</strong> &ldquo;{gap.prompt}&rdquo;
                  <span className="team-badge red" style={{ marginLeft: 8, fontSize: 9 }}>
                    {gap.errorCount} erro(s) registrado(s)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Toolbar / Filtros */}
      <div className="team-toolbar">
        <div className="field-search" style={{ minWidth: 260 }}>
          <Search size={17} />
          <input
            placeholder="Buscar por colaborador ou curso..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="team-select-field">
          <span>Situação:</span>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
          >
            <option value="all">Todas as situações</option>
            <option value="approved">Aprovadas</option>
            <option value="retry">Nova tentativa (Reprovadas)</option>
            <option value="pending">Aguardando correção</option>
          </select>
        </div>

        <div className="team-select-field">
          <span>Curso:</span>
          <select
            value={courseFilter}
            onChange={e => setCourseFilter(e.target.value)}
          >
            <option value="all">Todos os cursos</option>
            {courses.map(c => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabela de Avaliações */}
      {filteredAttempts.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>DATA</th>
                <th>COLABORADOR</th>
                <th>CURSO</th>
                <th>NOTA / MÍNIMA</th>
                <th>DIAGNÓSTICO</th>
                <th>SITUAÇÃO</th>
                <th style={{ textAlign: "right" }}>AÇÃO</th>
              </tr>
            </thead>
            <tbody>
              {filteredAttempts.map(attempt => {
                const person = people.find(p => p.id === attempt.userId);
                const analysis = analyzeAttempt(attempt);
                return (
                  <tr
                    key={attempt.id}
                    className="clickable-row"
                    onClick={() => onSelectAttempt(attempt)}
                  >
                    <td>
                      <strong>{new Date(attempt.submittedAt).toLocaleDateString("pt-BR")}</strong>
                      <small>{new Date(attempt.submittedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</small>
                    </td>
                    <td>
                      <div className="team-person-cell">
                        <span className="team-avatar" style={{ width: 30, height: 30, fontSize: 10, overflow: "hidden", padding: 0 }}>
                          {person?.avatar ? <img src={person.avatar} alt={person?.name || "Colaborador"} className="avatar-img" /> : initials(person?.name || "Colaborador")}
                        </span>
                        <div>
                          <strong>{person?.name || "Colaborador"}</strong>
                          <small>{person?.department}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <strong>{attempt.courseTitle}</strong>
                      <small>Versão {attempt.courseVersion}</small>
                    </td>
                    <td>
                      {attempt.score !== null ? (
                        <div>
                          <strong
                            style={{
                              color:
                                attempt.score >= attempt.passingScore ? "#10b981" : "#ef4444",
                              fontSize: 13,
                            }}
                          >
                            {attempt.score}%
                          </strong>
                          <small>Mínima: {attempt.passingScore}%</small>
                        </div>
                      ) : (
                        <span style={{ color: "var(--muted)" }}>Aguardando</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span className="team-badge green">
                          <Check size={11} /> {analysis.correctCount} acertos
                        </span>
                        {analysis.errorCount > 0 && (
                          <span className="team-badge red">
                            <X size={11} /> {analysis.errorCount} erros
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span
                        className={`pill ${
                          attempt.status === "approved"
                            ? "green"
                            : attempt.status === "retry"
                            ? "red"
                            : "amber"
                        }`}
                      >
                        {attempt.status === "approved"
                          ? "Aprovado"
                          : attempt.status === "retry"
                          ? "Nova tentativa"
                          : "Aguardando correção"}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={e => {
                          e.stopPropagation();
                          onSelectAttempt(attempt);
                        }}
                      >
                        <Eye size={13} /> Ver Prova
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          icon={<GraduationCap size={28} />}
          title="Nenhuma avaliação encontrada"
          description="Os envios de provas e questionários pelos colaboradores da equipe aparecerão listados aqui."
        />
      )}
    </div>
  );
}

// ============================================================================
// MODAL / DRAWER 360° DO COLABORADOR
// ============================================================================
function CollaboratorModal({
  person,
  courses,
  totalAvailableLessons,
  teamProgress,
  currentUserId,
  completedMap,
  attempts,
  engagement,
  engagementDays,
  engagementUnavailable,
  onClose,
  onSelectAttempt,
}: {
  person: Person;
  courses: Course[];
  totalAvailableLessons: number;
  teamProgress: Record<string, Record<string, string[]>> | undefined;
  currentUserId: string;
  completedMap: Record<string, string[]>;
  attempts: Attempt[];
  engagement?: EngagementMember;
  engagementDays: number;
  engagementUnavailable: boolean;
  onClose: () => void;
  onSelectAttempt: (attempt: Attempt) => void;
}) {
  const [tab, setTab] = useState<"courses" | "assessments" | "timeline">("courses");

  // Métricas do Colaborador
  const metrics = useMemo(() => {
    let watchedCount = 0;
    let studyMinutes = 0;
    let sectorTotal = 0;
    let sectorCompleted = 0;

    const courseDetails = courses.map(course => {
      const completedIds = getCompletedLessonIds(
        person.id,
        course.id,
        teamProgress,
        currentUserId,
        completedMap
      );
      const prog = courseProgress(course, completedIds);
      const isSector = isCourseForSector(course, person.department);
      const totalLessons = course.lessons.filter(l => l.type !== "quiz").length;
      const validCompleted = course.lessons.filter(
        l => l.type !== "quiz" && completedIds.includes(l.id)
      );

      watchedCount += validCompleted.length;
      studyMinutes += validCompleted.reduce((sum, l) => sum + l.minutes, 0);

      if (isSector) {
        sectorTotal += 1;
        if (prog === 100) sectorCompleted += 1;
      }

      const attempt = attempts.find(a => a.courseId === course.id);

      return {
        course,
        progress: prog,
        completedCount: validCompleted.length,
        totalLessons,
        isSector,
        status:
          prog === 100
            ? "Concluído"
            : prog > 0
            ? "Em andamento"
            : "Não iniciado",
        attempt,
      };
    });

    const watchedPercent =
      totalAvailableLessons > 0 ? Math.round((watchedCount / totalAvailableLessons) * 100) : 0;
    const sectorPercent =
      sectorTotal > 0 ? Math.round((sectorCompleted / sectorTotal) * 100) : 100;

    const scoredAttempts = attempts.filter(a => a.score !== null);
    const avgScore =
      scoredAttempts.length > 0
        ? Math.round(
            scoredAttempts.reduce((sum, a) => sum + (a.score || 0), 0) / scoredAttempts.length
          )
        : 0;

    return {
      watchedCount,
      watchedPercent,
      studyMinutes,
      sectorTotal,
      sectorCompleted,
      sectorPercent,
      avgScore,
      attemptsCount: attempts.length,
      courseDetails,
    };
  }, [person, courses, totalAvailableLessons, teamProgress, currentUserId, completedMap, attempts]);

  return (
    <div className="team-modal-backdrop" onClick={onClose}>
      <div className="team-modal-content" onClick={e => e.stopPropagation()}>
        {/* Header do Perfil */}
        <div className="team-modal-header">
          <div className="team-modal-profile">
            <div className="team-modal-avatar" style={{ overflow: "hidden", padding: 0 }}>{person.avatar ? <img src={person.avatar} alt={person.name} className="avatar-img" /> : initials(person.name)}</div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{person.name}</h2>
                <span className="team-badge primary">{person.department}</span>
                <span className={`pill ${person.status === "active" ? "green" : "amber"}`}>
                  {person.status === "active" ? "Ativo" : "Pendente"}
                </span>
              </div>
              <small style={{ color: "var(--muted)", display: "block", marginTop: 2 }}>
                {person.email || "E-mail não informado"} ·{" "}
                {person.role === "manager"
                  ? "Gestor"
                  : person.role === "admin"
                  ? "Administrador"
                  : "Colaborador"}
              </small>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </Button>
        </div>

        {/* Corpo do Modal */}
        <div className="team-modal-body">
          <MemberEngagement member={engagement} days={engagementDays} unavailable={engagementUnavailable} />
          {/* Indicadores do Colaborador */}
          <div className="team-modal-kpi-row">
            <div className="team-modal-kpi-item">
              <small>CONTEÚDOS ASSISTIDOS</small>
              <strong>
                {metrics.watchedCount} / {totalAvailableLessons}
              </strong>
              <span>{metrics.watchedPercent}% do catálogo total</span>
            </div>

            <div className="team-modal-kpi-item">
              <small>DIAS COM ACESSO</small>
              <strong>{engagement ? `${engagement.activeDays} / ${engagementDays}` : "—"}</strong>
              <span>Constância no período</span>
            </div>

            <div className="team-modal-kpi-item">
              <small>MÉDIA EM AVALIAÇÕES</small>
              <strong style={{ color: metrics.avgScore >= 70 ? "#10b981" : metrics.attemptsCount ? "#ef4444" : "inherit" }}>
                {metrics.attemptsCount ? `${metrics.avgScore}%` : "—"}
              </strong>
              <span>{metrics.attemptsCount} prova(s) realizada(s)</span>
            </div>

            <div className="team-modal-kpi-item">
              <small>TEMPO ESTIMADO</small>
              <strong>{(metrics.studyMinutes / 60).toFixed(1)}h</strong>
              <span>{person.xp.toLocaleString("pt-BR")} XP acumulados</span>
            </div>
          </div>

          {/* Sub-abas */}
          <div className="tabs" style={{ marginBottom: 18 }}>
            <button
              type="button"
              className={tab === "courses" ? "selected" : ""}
              onClick={() => setTab("courses")}
            >
              <BookOpen size={14} /> Cursos & Trilhas ({courses.length})
            </button>
            <button
              type="button"
              className={tab === "assessments" ? "selected" : ""}
              onClick={() => setTab("assessments")}
            >
              <Award size={14} /> Avaliações & Análise de Erros ({attempts.length})
            </button>
            <button
              type="button"
              className={tab === "timeline" ? "selected" : ""}
              onClick={() => setTab("timeline")}
            >
              <Clock3 size={14} /> Histórico de Ações
            </button>
          </div>

          {/* SUB-ABA 1: CURSOS */}
          {tab === "courses" && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>CURSO</th>
                    <th>PRODUTO / ASSUNTO</th>
                    <th>SETOR ALVO</th>
                    <th>AULAS CONCLUÍDAS</th>
                    <th>PROGRESSO</th>
                    <th>AVALIAÇÃO</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.courseDetails.map(item => (
                    <tr key={item.course.id}>
                      <td>
                        <strong>{item.course.title}</strong>
                        <small>{item.course.level}</small>
                      </td>
                      <td>
                        <span className="team-badge">{item.course.product}</span>
                      </td>
                      <td>
                        {item.isSector ? (
                          <span className="team-badge green">
                            <Target size={11} /> Específico do Setor
                          </span>
                        ) : (
                          <span className="team-badge">Geral</span>
                        )}
                      </td>
                      <td>
                        {item.completedCount} de {item.totalLessons} aulas
                      </td>
                      <td>
                        <div className="team-progress-cell">
                          <div className="team-progress-meta">
                            <span>{item.progress}%</span>
                            <small>{item.status}</small>
                          </div>
                          <Progress value={item.progress} label={`Progresso em ${item.course.title}`} />
                        </div>
                      </td>
                      <td>
                        {item.attempt ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => onSelectAttempt(item.attempt!)}
                            title="Ver detalhes da prova e erros"
                          >
                            <span
                              style={{
                                color:
                                  (item.attempt.score || 0) >= item.attempt.passingScore
                                    ? "#10b981"
                                    : "#ef4444",
                                fontWeight: 700,
                              }}
                            >
                              {item.attempt.score}%
                            </span>{" "}
                            · Ver prova
                          </Button>
                        ) : (
                          <span style={{ color: "var(--muted)", fontSize: 11 }}>Não realizada</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* SUB-ABA 2: AVALIAÇÕES & ANÁLISE DE ERROS */}
          {tab === "assessments" && (
            <div>
              {attempts.length ? (
                attempts.map(attempt => {
                  const analysis = analyzeAttempt(attempt);
                  return (
                    <div key={attempt.id} className="team-question-card" style={{ marginBottom: 20 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          borderBottom: "1px solid var(--line)",
                          paddingBottom: 12,
                          marginBottom: 14,
                        }}
                      >
                        <div>
                          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
                            {attempt.courseTitle}
                          </h3>
                          <small style={{ color: "var(--muted)" }}>
                            Enviada em {new Date(attempt.submittedAt).toLocaleDateString("pt-BR")} às{" "}
                            {new Date(attempt.submittedAt).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </small>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span
                            className={`pill ${
                              attempt.status === "approved"
                                ? "green"
                                : attempt.status === "retry"
                                ? "red"
                                : "amber"
                            }`}
                          >
                            {attempt.status === "approved"
                              ? "Aprovado"
                              : attempt.status === "retry"
                              ? "Nova tentativa"
                              : "Aguardando correção"}
                          </span>
                          <span
                            style={{
                              fontSize: 14,
                              fontWeight: 750,
                              color:
                                (attempt.score || 0) >= attempt.passingScore ? "#10b981" : "#ef4444",
                            }}
                          >
                            {attempt.score !== null ? `${attempt.score}%` : "—"}
                          </span>
                        </div>
                      </div>

                      {/* Resumo de Acertos e Erros */}
                      <div
                        style={{
                          display: "flex",
                          gap: 12,
                          alignItems: "center",
                          marginBottom: 14,
                          fontSize: 11,
                        }}
                      >
                        <span className="team-badge green">
                          <CheckCircle2 size={13} /> {analysis.correctCount} acertos
                        </span>
                        <span className={`team-badge ${analysis.errorCount > 0 ? "red" : ""}`}>
                          <XCircle size={13} /> {analysis.errorCount} erros
                        </span>
                        <span style={{ color: "var(--muted)", marginLeft: "auto" }}>
                          Nota mínima exigida: {attempt.passingScore}%
                        </span>
                      </div>

                      {/* Detalhamento Questão por Questão com Erros */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {analysis.questionDetails.map((q, idx) => (
                          <div
                            key={q.id}
                            className={`team-question-card ${q.isCorrect ? "is-correct" : "is-error"}`}
                          >
                            <div className="team-question-header">
                              <span style={{ fontWeight: 700, fontSize: 11 }}>
                                Questão {idx + 1} ({q.type === "choice" ? "Múltipla escolha" : "Dissertativa"})
                              </span>
                              <span
                                className={`team-badge ${q.isCorrect ? "green" : "red"}`}
                                style={{ fontSize: 9 }}
                              >
                                {q.isCorrect ? (
                                  <>
                                    <Check size={11} /> Acerto
                                  </>
                                ) : (
                                  <>
                                    <X size={11} /> Erro do Aluno
                                  </>
                                )}
                              </span>
                            </div>

                            <div className="team-question-prompt">{q.prompt}</div>

                            <div className="team-answer-comparison">
                              <div
                                className={`team-answer-box user-answer ${!q.isCorrect ? "wrong" : ""}`}
                              >
                                <small>Resposta fornecida pelo colaborador:</small>
                                <span>{q.userAnswer}</span>
                              </div>

                              {!q.isCorrect && q.correctAnswer && (
                                <div className="team-answer-box correct-gabarito">
                                  <small>Gabarito oficial esperado:</small>
                                  <span>{q.correctAnswer}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Feedback do avaliador se houver */}
                      {attempt.feedback && (
                        <div className="team-feedback-box">
                          <strong>Feedback da Avaliação:</strong> {attempt.feedback}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <EmptyState
                  icon={<Award size={28} />}
                  title="Nenhuma avaliação realizada"
                  description="Este colaborador ainda não enviou questionários ou provas finais."
                />
              )}
            </div>
          )}

          {/* SUB-ABA 3: HISTÓRICO DE AÇÕES */}
          {tab === "timeline" && (
            <div style={{ padding: "8px 0" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {attempts.map(a => (
                  <div
                    key={a.id}
                    style={{
                      display: "flex",
                      gap: 12,
                      alignItems: "flex-start",
                      fontSize: 11,
                      padding: "8px 12px",
                      background: "var(--surface2)",
                      borderRadius: 8,
                    }}
                  >
                    <div style={{ marginTop: 2, color: "var(--primary)" }}>
                      <Award size={16} />
                    </div>
                    <div>
                      <strong>Avaliação enviada: {a.courseTitle}</strong>
                      <div style={{ color: "var(--muted)", fontSize: 10 }}>
                        {new Date(a.submittedAt).toLocaleDateString("pt-BR")} às{" "}
                        {new Date(a.submittedAt).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        · Nota: {a.score ?? "Pendente"}% ({a.status})
                      </div>
                    </div>
                  </div>
                ))}

                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "flex-start",
                    fontSize: 11,
                    padding: "8px 12px",
                    background: "var(--surface2)",
                    borderRadius: 8,
                  }}
                >
                  <div style={{ marginTop: 2, color: "var(--primary)" }}>
                    <Sparkles size={16} />
                  </div>
                  <div>
                    <strong>Pontuação acumulada</strong>
                    <div style={{ color: "var(--muted)", fontSize: 10 }}>
                      Total de {person.xp.toLocaleString("pt-BR")} XP conquistados na temporada.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MODAL DE DETALHE DE PROVA / ERROS (ABERTO DIRETO DA ABA DE AVALIAÇÕES)
// ============================================================================
function AttemptDetailModal({
  attempt,
  person,
  onClose,
}: {
  attempt: Attempt;
  person?: Person;
  onClose: () => void;
}) {
  const analysis = analyzeAttempt(attempt);

  return (
    <div className="team-modal-backdrop" onClick={onClose}>
      <div className="team-modal-content" onClick={e => e.stopPropagation()}>
        <div className="team-modal-header">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                {attempt.courseTitle}
              </h2>
              <span
                className={`pill ${
                  attempt.status === "approved"
                    ? "green"
                    : attempt.status === "retry"
                    ? "red"
                    : "amber"
                }`}
              >
                {attempt.status === "approved"
                  ? "Aprovado"
                  : attempt.status === "retry"
                  ? "Nova tentativa"
                  : "Aguardando correção"}
              </span>
            </div>
            <small style={{ color: "var(--muted)", display: "block", marginTop: 2 }}>
              Colaborador: {person?.name || "Aluno"} ({person?.department || "Geral"}) · Enviada em{" "}
              {new Date(attempt.submittedAt).toLocaleDateString("pt-BR")} às{" "}
              {new Date(attempt.submittedAt).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </small>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </Button>
        </div>

        <div className="team-modal-body">
          {/* Métricas da Prova */}
          <div className="team-modal-kpi-row" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            <div className="team-modal-kpi-item">
              <small>NOTA OBTIDA</small>
              <strong
                style={{
                  color:
                    (attempt.score || 0) >= attempt.passingScore ? "#10b981" : "#ef4444",
                }}
              >
                {attempt.score !== null ? `${attempt.score}%` : "—"}
              </strong>
              <span>Mínima para aprovação: {attempt.passingScore}%</span>
            </div>

            <div className="team-modal-kpi-item">
              <small>ACERTOS</small>
              <strong style={{ color: "#10b981" }}>{analysis.correctCount}</strong>
              <span>de {analysis.totalQuestions} questões</span>
            </div>

            <div className="team-modal-kpi-item">
              <small>ERROS IDENTIFICADOS</small>
              <strong style={{ color: analysis.errorCount > 0 ? "#ef4444" : "#10b981" }}>
                {analysis.errorCount}
              </strong>
              <span>necessitam de reforço</span>
            </div>
          </div>

          {/* Feedback */}
          {attempt.feedback && (
            <div className="team-feedback-box" style={{ marginBottom: 18 }}>
              <strong>Feedback registrado:</strong> {attempt.feedback}
            </div>
          )}

          {/* Detalhamento Questão por Questão */}
          <h4 style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700 }}>
            Questões, Respostas do Aluno e Gabarito:
          </h4>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {analysis.questionDetails.map((q, idx) => (
              <div
                key={q.id}
                className={`team-question-card ${q.isCorrect ? "is-correct" : "is-error"}`}
              >
                <div className="team-question-header">
                  <span style={{ fontWeight: 700, fontSize: 11 }}>
                    Questão {idx + 1} ({q.type === "choice" ? "Múltipla escolha" : "Dissertativa"})
                  </span>
                  <span
                    className={`team-badge ${q.isCorrect ? "green" : "red"}`}
                    style={{ fontSize: 9 }}
                  >
                    {q.isCorrect ? (
                      <>
                        <Check size={11} /> Acerto
                      </>
                    ) : (
                      <>
                        <X size={11} /> Erro do Aluno
                      </>
                    )}
                  </span>
                </div>

                <div className="team-question-prompt">{q.prompt}</div>

                <div className="team-answer-comparison">
                  <div
                    className={`team-answer-box user-answer ${!q.isCorrect ? "wrong" : ""}`}
                  >
                    <small>Resposta fornecida pelo colaborador:</small>
                    <span>{q.userAnswer}</span>
                  </div>

                  {!q.isCorrect && q.correctAnswer && (
                    <div className="team-answer-box correct-gabarito">
                      <small>Gabarito oficial esperado:</small>
                      <span>{q.correctAnswer}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
