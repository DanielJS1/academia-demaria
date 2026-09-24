"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Bell, BookOpen, ChevronLeft, ChevronRight, CircleHelp, GraduationCap, Home, Menu, Moon, Settings2, ShieldCheck, Sparkles, Sun, Trophy, Users, X } from "lucide-react";
import { useAcademy } from "./academy-provider";
import { GlobalSearch } from "./global-search";
import { Button } from "./ui/button";
import { experience } from "@/lib/gamification";

const navigation = [
  { href: "/", label: "Visão geral", icon: Home },
  { href: "/aprender", label: "Aprender", icon: BookOpen },
  { href: "/conhecimento", label: "Conhecimento", icon: Sparkles, badge: "IA" },
  { href: "/conquistas", label: "Minha evolução", icon: Trophy },
];

const defaultNotices = [
  { id: "welcome", title: "Seu próximo nível começa aqui", text: "Conheça o novo espaço de aprendizado.", href: "/aprender" },
  { id: "knowledge", title: "Conhecimento sempre por perto", text: "Explore os guias da plataforma.", href: "/conhecimento" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { state, me, update, theme, toggleTheme, storageError, signOut, activeCartorio, simulatedCartorioId, setSimulatedCartorioId, isClientEnvironment, avatar } = useAcademy();
  const exp = experience(state);
  const classroomCourseId = path.match(/^\/aprender\/([^/]+)\/aula\/?$/)?.[1];
  const classroomCourse = classroomCourseId ? [...state.courses, ...state.courseDrafts].find(course => course.id === decodeURIComponent(classroomCourseId)) : undefined;

  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileDrawerRef = useRef<HTMLElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [theaterCollapsed, setTheaterCollapsed] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [hoveredNavIndex, setHoveredNavIndex] = useState<number | null>(null);
  const [noticesOpen, setNoticesOpen] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 760);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("doc_academy_sidebar_collapsed");
      if (saved !== null) {
        setCollapsed(saved === "true");
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (mobileOpen) mobileMenuButtonRef.current?.focus();
    setMobileOpen(false);
    setNoticesOpen(false);
  }, [path]);

  useEffect(() => {
    if (!mobileOpen || !isMobile) return;
    const drawer = mobileDrawerRef.current;
    if (!drawer) return;
    const focusable = () => Array.from(drawer.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter(element => element.getClientRects().length > 0);
    const firstFocusable = focusable()[0];
    firstFocusable?.focus();
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileOpen(false);
        mobileMenuButtonRef.current?.focus();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) { event.preventDefault(); drawer.focus(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || !drawer.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !drawer.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", trapFocus);
    return () => document.removeEventListener("keydown", trapFocus);
  }, [mobileOpen, isMobile]);

  const closeMobileMenu = () => {
    setMobileOpen(false);
    mobileMenuButtonRef.current?.focus();
  };

  const toggleCollapsed = () => {
    if (/^\/aprender\/[^/]+\/aula/.test(path)) { setTheaterCollapsed(value => !value); return; }
    setCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem("doc_academy_sidebar_collapsed", String(next));
      } catch {}
      return next;
    });
  };

  const isDocked = !isMobile && (/^\/aprender\/[^/]+\/aula/.test(path) ? theaterCollapsed : collapsed);
  const active = (href: string) => href === "/" ? path === "/" : path.startsWith(href);

  const currentNav = isClientEnvironment
    ? [
        { href: "/", label: "Visão geral", icon: Home },
        { href: "/aprender", label: "Aprender", icon: BookOpen },
      ]
    : navigation;

  const updateNotices = isClientEnvironment ? [] : state.articles
    .filter(article => article.authorId === me.id && article.updateRequest)
    .map(article => ({
      id: `update:${article.id.slice(0, 60)}:${Date.parse(article.updateRequest!.requestedAt)}`,
      title: `Atualize seu artigo: ${article.title}`,
      text: article.updateRequest!.message,
      href: `/conhecimento/${encodeURIComponent(article.id)}/editar`,
    }));
  const notices = [...updateNotices, ...defaultNotices];
  const unread = notices.filter(item => !state.readNotices.includes(item.id)).length;

  const allNavItems = isClientEnvironment
    ? currentNav
    : [
        ...navigation,
        ...(me.role !== "student" ? [{ href: "/equipe", label: "Minha equipe", icon: Users }] : []),
        ...(me.role === "admin" ? [{ href: "/admin", label: "Administração", icon: Settings2 }] : []),
        { href: "/sobre", label: "Sobre a plataforma", icon: CircleHelp },
      ];

  return (
    <div className="app">
      <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>
      {mobileOpen && (
        <button
          className="nav-scrim"
          aria-label="Fechar navegação"
          onClick={closeMobileMenu}
        />
      )}
      <aside
        ref={mobileDrawerRef}
        className={`sidebar group ${mobileOpen ? "is-open" : ""} ${isDocked ? "is-collapsed" : ""}`}
        role={mobileOpen && isMobile ? "dialog" : undefined}
        aria-modal={mobileOpen && isMobile ? true : undefined}
        tabIndex={mobileOpen && isMobile ? -1 : undefined}
        aria-label="Navegação principal"
        onMouseLeave={() => setHoveredNavIndex(null)}
      >
        <div className="sidebar-header">
          <div className="sidebar-brand-control">
            <Link href="/" className="brand" aria-label="DOC-Academy — início" onClick={closeMobileMenu}>
              {isDocked ? (
                <img className="brand-official" src="/doc-academy-logo-oficial.png" alt="DOC-Academy"/>
              ) : (
                <span className="brand-title">
                  <strong>DOC·<span>Academy</span></strong>
                </span>
              )}
            </Link>
            {isDocked && (
              <button type="button" className="sidebar-brand-toggle" onClick={toggleCollapsed}
                aria-label="Expandir barra lateral" title="Expandir barra lateral">
                <ChevronRight size={22} />
              </button>
            )}
          </div>
          {!isMobile && !isDocked && (
            <button type="button" className="sidebar-collapse-btn" onClick={toggleCollapsed}
              aria-label="Recolher barra lateral" title="Recolher barra lateral">
              <ChevronLeft size={22} />
            </button>
          )}
          {isMobile ? (
            <Button
              variant="ghost"
              size="icon"
              className="sidebar-close-btn"
              onClick={closeMobileMenu}
              aria-label="Fechar menu"
            >
              <X size={20} />
            </Button>
          ) : null}
        </div>

        {isMobile && <GlobalSearch courses={state.courses} userId={me.id} />}

        {isDocked ? (
          <>
            <nav className="sidebar-dock-items" aria-label="Atalhos principais">
              {allNavItems.map((item, index) => {
                const isCurrent = active(item.href);
                const Icon = item.icon;
                const dist = hoveredNavIndex === null ? null : Math.abs(hoveredNavIndex - index);

                let scale = 1;
                let transX = 0;
                let zIndex = 1;

                if (dist === 0) {
                  scale = 1.28;
                  transX = 8;
                  zIndex = 30;
                } else if (dist === 1) {
                  scale = 1.15;
                  transX = 4;
                  zIndex = 20;
                } else if (dist === 2) {
                  scale = 1.06;
                  transX = 2;
                  zIndex = 10;
                }

                return (
                  <div
                    key={item.href}
                    className="sidebar-dock-item-wrap"
                    style={{
                      transform: `scale(${scale}) translateX(${transX}px)`,
                      zIndex,
                      transition: "transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)",
                    }}
                    onMouseEnter={() => setHoveredNavIndex(index)}
                  >
                    <Link
                      href={item.href}
                      className={`sidebar-dock-item-btn ${isCurrent ? "active" : ""}`}
                      aria-label={item.label}
                      aria-current={isCurrent ? "page" : undefined}
                    >
                      <Icon size={20} />
                    </Link>
                    {hoveredNavIndex === index && (
                      <div className="sidebar-dock-tooltip" role="tooltip">
                        <span>{item.label}</span>
                        {"badge" in item && item.badge && <span className="nav-ai">{item.badge}</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
            <div className="sidebar-dock-bottom">
              <Link
                href="/sobre"
                className="sidebar-dock-item-btn"
                aria-label="Sobre a plataforma"
                title="Sobre a plataforma"
              >
                <CircleHelp size={18} />
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="sidebar-nav-scroll">
              {isClientEnvironment && activeCartorio && (
                <div className="workspace-label">
                  <span className="workspace-dot" style={{ background: "var(--success-foreground)" }}/>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {activeCartorio.name}
                  </span>
                  <span className="workspace-tag" style={{ background: "var(--mint-subtle)", color: "var(--success-foreground)" }}>
                    {activeCartorio?.uf || "CLIENTE"}
                  </span>
                </div>
              )}
              <span className="nav-label">{isClientEnvironment ? "CAPACITAÇÃO" : "SEU ESPAÇO"}</span>
              <nav>
                {currentNav.map(({ href, label, icon: Icon, badge }: any) => (
                  <Link
                    className={`nav-item ${active(href) ? "active" : ""}`}
                    href={href}
                    key={href}
                    aria-current={active(href) ? "page" : undefined}
                    onClick={closeMobileMenu}
                  >
                    <Icon size={19}/>
                    <span>{label}</span>
                    {badge && <span className="nav-ai">{badge}</span>}
                  </Link>
                ))}
              </nav>
              {!isClientEnvironment && me.role !== "student" && <span className="nav-label manage-label">GESTÃO</span>}
              {!isClientEnvironment && (
                <nav>
                  {me.role !== "student" && (
                    <Link
                      href="/equipe"
                      className={`nav-item ${active("/equipe") ? "active" : ""}`}
                      aria-current={active("/equipe") ? "page" : undefined}
                      onClick={closeMobileMenu}
                    >
                      <Users size={19}/> <span>Minha equipe</span>
                    </Link>
                  )}
                  {me.role === "admin" && (
                    <Link
                      href="/admin"
                      className={`nav-item ${active("/admin") ? "active" : ""}`}
                      aria-current={active("/admin") ? "page" : undefined}
                      onClick={closeMobileMenu}
                    >
                      <Settings2 size={19}/> <span>Administração</span>
                    </Link>
                  )}
                </nav>
              )}
            </div>
            <div className="sidebar-bottom">
              <Link className="help-link" href="/sobre" onClick={closeMobileMenu}>
                <CircleHelp size={17}/> <span>Sobre a plataforma</span>
              </Link>
              {isMobile && (
                <div className="mobile-drawer-account">
                  <Link href="/conquistas" className="nav-item" onClick={closeMobileMenu}>
                    <Trophy size={18} /> <span>Minha evolução</span>
                  </Link>
                  <button type="button" className="mobile-signout-btn" onClick={signOut}>
                    Sair da conta
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </aside>
      <div className={`app-content ${isDocked ? "sidebar-collapsed" : ""}`}>
        <header className="topbar">
          <button ref={mobileMenuButtonRef} type="button" className="button button-ghost button-icon mobile-menu" onClick={() => setMobileOpen(true)}
            aria-label="Abrir menu" aria-expanded={mobileOpen}>
            <Menu size={22}/>
          </button>
          {classroomCourseId ? (
            <Link className="topbar-course-back" href={`/aprender/${classroomCourseId}`} title={classroomCourse?.title || "Voltar ao curso"}>
              <ChevronLeft size={18} aria-hidden="true" /> <span>{classroomCourse?.title || "Voltar ao curso"}</span>
            </Link>
          ) : <GlobalSearch courses={state.courses} userId={me.id} />}
          <div className="topbar-actions">
            {me.role === "admin" && (
              <div className="sim-switcher-wrap desktop-only">
                <select
                  aria-label="Simular ambiente de cartório"
                  className="sim-select"
                  value={simulatedCartorioId || ""}
                  onChange={e => setSimulatedCartorioId(e.target.value || null)}
                >
                  <option value="">Ambiente: Interno (DeMaria)</option>
                  <optgroup label="Simular como Cartório Cliente">
                    {(state.cartorios || []).map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.uf})
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
            )}
            <Link href="/sobre" className="demo-tag"><span/> {isClientEnvironment ? "Área do Cliente" : "Piloto interno"}</Link>
            <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label={theme === "light" ? "Ativar tema escuro" : "Ativar tema claro"}>
              {theme === "light" ? <Moon size={19}/> : <Sun size={19}/>}
            </Button>
            <div className="notifications">
              <Button variant="ghost" size="icon" aria-label="Notificações" aria-expanded={noticesOpen} onClick={() => setNoticesOpen(!noticesOpen)}>
                <Bell size={19}/>
                {unread > 0 && <span className="notification-dot"/>}
              </Button>
              {noticesOpen && (
                <section className="notification-panel" aria-label="Novidades">
                  <div className="section-title">
                    <h3>Novidades</h3>
                    <Button size="icon" variant="ghost" aria-label="Fechar notificações" onClick={() => setNoticesOpen(false)}>
                      <X size={16}/>
                    </Button>
                  </div>
                  {notices.map(item => (
                    <Link
                      href={item.href}
                      key={item.id}
                      onClick={() => {
                        update(current => ({
                          ...current,
                          readNotices: Array.from(new Set([...current.readNotices, item.id])),
                        }));
                        setNoticesOpen(false);
                      }}
                    >
                      <span className="notification-symbol"><Sparkles size={16}/></span>
                      <span><strong>{item.title}</strong><small>{item.text}</small></span>
                      {!state.readNotices.includes(item.id) && <i/>}
                    </Link>
                  ))}
                </section>
              )}
            </div>
            <span className="topbar-divider"/>
            {isClientEnvironment ? (
              <Link href="/conquistas" className="profile" aria-label="Ver minha evolução">
                <span className="avatar avatar-daniel" style={{ background: avatar ? "transparent" : "var(--mint-9)", color: "#fff" }}>
                  {avatar ? (
                    <img src={avatar} alt={me.name} className="avatar-img" />
                  ) : (
                    me.name.slice(0, 1)
                  )}
                </span>
                <span className="profile-details desktop-only">
                  <strong>{me.name.split(" ")[0]}</strong>
                  <span className="profile-level-badge" style={{ background: "var(--mint-subtle)", color: "var(--success-foreground)" }}>
                    <ShieldCheck size={10} /> {activeCartorio?.uf || "Cliente"}
                  </span>
                </span>
              </Link>
            ) : (
              <Link href="/conquistas" className="profile" aria-label={`Ver minha evolução — Nível ${exp.level}, ${exp.total} XP`}>
                <span className="avatar avatar-daniel" style={{ background: avatar ? "transparent" : undefined }}>
                  {avatar ? (
                    <img src={avatar} alt={me.name} className="avatar-img" />
                  ) : (
                    me.name.slice(0, 1)
                  )}
                </span>
                <span className="profile-details desktop-only">
                  <strong>{me.name.split(" ")[0]}</strong>
                  <span className="profile-level-badge">
                    <Trophy size={10} /> Nível {exp.level} · {exp.total} XP
                  </span>
                </span>
              </Link>
            )}
            <Button variant="ghost" className="desktop-only" onClick={signOut}>Sair</Button>
          </div>
        </header>
        {simulatedCartorioId && activeCartorio && (
          <div className="sim-notice-banner">
            <span>
              <strong>Simulação de Ambiente Ativa:</strong> Você está visualizando como <strong>{activeCartorio.name} ({activeCartorio.uf})</strong> — {activeCartorio.modules.length} módulos contratados.
            </span>
            <Button size="sm" variant="secondary" onClick={() => setSimulatedCartorioId(null)}>
              Encerrar simulação
            </Button>
          </div>
        )}
        {storageError && <div className="storage-warning" role="alert">Não foi possível atualizar os dados do servidor. Confira sua conexão e tente novamente.</div>}
        <main id="conteudo" className="main-content">{children}</main>
        <footer className="main-footer">
          <span>DOC-Academy <span>·</span> Feito para evoluir com você.</span>
          <span>Ambiente interno · progresso salvo na sua conta</span>
        </footer>
      </div>
    </div>
  );
}
