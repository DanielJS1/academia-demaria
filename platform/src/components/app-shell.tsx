"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Bell, BookOpen, ChevronLeft, ChevronRight, CircleHelp, GraduationCap, Home, Menu, Moon, Search, Settings2, Sparkles, Sun, Trophy, Users, X } from "lucide-react";
import { useAcademy } from "./academy-provider";
import { Button } from "./ui/button";
import { experience } from "@/lib/gamification";

const navigation = [
  { href: "/", label: "Visão geral", icon: Home },
  { href: "/aprender", label: "Aprender", icon: BookOpen },
  { href: "/conhecimento", label: "Conhecimento", icon: Sparkles, badge: "IA" },
  { href: "/conquistas", label: "Minha evolução", icon: Trophy },
];

const notices = [
  { id: "welcome", title: "Seu próximo nível começa aqui", text: "Conheça o novo espaço de aprendizado.", href: "/aprender" },
  { id: "knowledge", title: "Conhecimento sempre por perto", text: "Explore os guias da plataforma.", href: "/conhecimento" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { state, me, update, theme, toggleTheme, storageError, signOut } = useAcademy();
  const exp = experience(state);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [hoveredNavIndex, setHoveredNavIndex] = useState<number | null>(null);
  const [noticesOpen, setNoticesOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

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
    setMobileOpen(false);
    setNoticesOpen(false);
  }, [path]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === "Escape") {
        setMobileOpen(false);
        setNoticesOpen(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem("doc_academy_sidebar_collapsed", String(next));
      } catch {}
      return next;
    });
  };

  const handleMenuClick = () => {
    if (typeof window !== "undefined" && window.innerWidth <= 760) {
      setMobileOpen(prev => !prev);
    } else {
      toggleCollapsed();
    }
  };

  const isDocked = !isMobile && collapsed;
  const active = (href: string) => href === "/" ? path === "/" : path.startsWith(href);

  const title = [
    ...navigation,
    { href: "/equipe", label: "Minha equipe" },
    { href: "/admin", label: "Administração" },
    { href: "/sobre", label: "Sobre esta versão" },
  ].find(item => item.href !== "/" && active(item.href))?.label || "Visão geral";

  const unread = notices.filter(item => !state.readNotices.includes(item.id)).length;

  const allNavItems = [
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
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={`sidebar ${mobileOpen ? "is-open" : ""} ${isDocked ? "is-collapsed" : ""}`}
        aria-label="Navegação principal"
        onMouseLeave={() => setHoveredNavIndex(null)}
      >
        <div className="sidebar-header">
          <Link href="/" className="brand" aria-label="DOC-Academy — início" onClick={() => setMobileOpen(false)}>
            <img className="brand-official" src="/doc-academy-logo-oficial.png" alt="DOC-Academy"/>
          </Link>
          {isMobile ? (
            <Button
              variant="ghost"
              size="icon"
              className="sidebar-close-btn"
              onClick={() => setMobileOpen(false)}
              aria-label="Fechar menu"
            >
              <X size={20} />
            </Button>
          ) : (
            <button
              type="button"
              className="sidebar-collapse-mini-btn"
              onClick={toggleCollapsed}
              title={collapsed ? "Expandir barra lateral" : "Recolher barra lateral"}
              aria-label={collapsed ? "Expandir barra lateral" : "Recolher barra lateral"}
            >
              {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>
          )}
        </div>

        {isDocked ? (
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
        ) : (
          <>
            <div className="workspace-label"><span className="workspace-dot"/> DeMaria <span className="workspace-tag">INTERNO</span></div>
            <span className="nav-label">SEU ESPAÇO</span>
            <nav>
              {navigation.map(({ href, label, icon: Icon, badge }) => (
                <Link
                  className={`nav-item ${active(href) ? "active" : ""}`}
                  href={href}
                  key={href}
                  aria-current={active(href) ? "page" : undefined}
                  onClick={() => setMobileOpen(false)}
                >
                  <Icon size={19}/>
                  <span>{label}</span>
                  {badge && <span className="nav-ai">{badge}</span>}
                </Link>
              ))}
            </nav>
            {me.role !== "student" && <span className="nav-label manage-label">GESTÃO</span>}
            <nav>
              {me.role !== "student" && (
                <Link
                  href="/equipe"
                  className={`nav-item ${active("/equipe") ? "active" : ""}`}
                  aria-current={active("/equipe") ? "page" : undefined}
                  onClick={() => setMobileOpen(false)}
                >
                  <Users size={19}/> <span>Minha equipe</span>
                </Link>
              )}
              {me.role === "admin" && (
                <Link
                  href="/admin"
                  className={`nav-item ${active("/admin") ? "active" : ""}`}
                  aria-current={active("/admin") ? "page" : undefined}
                  onClick={() => setMobileOpen(false)}
                >
                  <Settings2 size={19}/> <span>Administração</span>
                </Link>
              )}
            </nav>
            <div className="sidebar-bottom">
              {!isMobile && (
                <div className="sidebar-note">
                  <span className="little-star"><Sparkles size={17}/></span>
                  <strong>Conhecimento abre caminhos.</strong>
                  <p>Um novo aprendizado.<br/>Uma nova possibilidade.</p>
                  <Link href="/aprender">Explore os cursos <ArrowUpRight size={16}/></Link>
                </div>
              )}
              <Link className="help-link" href="/sobre" onClick={() => setMobileOpen(false)}><CircleHelp size={17}/> <span>Sobre a plataforma</span></Link>
              {isMobile ? (
                <div className="mobile-drawer-account">
                  <Link href="/acesso" className="nav-item" onClick={() => setMobileOpen(false)}>
                    Minha senha
                  </Link>
                  <button type="button" className="mobile-signout-btn" onClick={signOut}>
                    Sair da conta
                  </button>
                </div>
              ) : (
                <div className="sidebar-footer"><Link href="/" className="brand"><strong>DOC-<span>Academy</span></strong></Link></div>
              )}
            </div>
          </>
        )}
      </aside>
      <div className={`app-content ${isDocked ? "sidebar-collapsed" : ""}`}>
        <header className="topbar">
          <div className="breadcrumb">
            <Button
              variant="ghost"
              size="icon"
              className="sidebar-toggle-btn"
              onClick={handleMenuClick}
              aria-label={isDocked ? "Expandir barra lateral" : "Recolher barra lateral"}
              title={isDocked ? "Expandir barra lateral" : "Recolher barra lateral (modo foco)"}
              aria-expanded={mobileOpen || !isDocked}
            >
              <Menu size={22}/>
            </Button>
            <span>Meu espaço</span>
            <ChevronRight size={14}/>
            <strong>{title}</strong>
          </div>
          <form className="global-search" role="search" onSubmit={event => { event.preventDefault(); router.push(`/aprender?busca=${encodeURIComponent(search)}`); }}>
            <Search size={17}/>
            <input ref={searchRef} aria-label="Buscar cursos" placeholder="O que você quer aprender?" value={search} onChange={event => setSearch(event.target.value)}/>
          </form>
          <div className="topbar-actions">
            <Link href="/sobre" className="demo-tag"><span/> Piloto interno</Link>
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
            <Link href="/conquistas" className="profile" aria-label={`Ver minha evolução — Nível ${exp.level}, ${exp.total} XP`}>
              <span className="avatar avatar-daniel">{me.name.slice(0,1)}</span>
              <span className="profile-details desktop-only"><strong>{me.name.split(" ")[0]}</strong><span className="profile-level-badge"><Trophy size={10}/> Nível {exp.level} · {exp.total} XP</span></span>
            </Link>
            <Link className="help-link desktop-only" href="/acesso">Minha senha</Link>
            <Button variant="ghost" className="desktop-only" onClick={signOut}>Sair</Button>
          </div>
        </header>
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
