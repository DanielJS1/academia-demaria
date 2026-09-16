"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Bell, BookOpen, ChevronRight, CircleHelp, GraduationCap, Home, Menu, Moon, Search, Settings2, Sparkles, Sun, Trophy, Users, X } from "lucide-react";
import { useAcademy } from "./academy-provider";
import { Button } from "./ui/button";
const navigation = [
  { href: "/", label: "Visão geral", icon: Home }, { href: "/aprender", label: "Aprender", icon: BookOpen },
  { href: "/conhecimento", label: "Conhecimento", icon: Sparkles }, { href: "/conquistas", label: "Minha evolução", icon: Trophy },
];
const notices = [{ id: "welcome", title: "Seu próximo nível começa aqui", text: "Conheça o novo espaço de aprendizado.", href: "/aprender" }, { id: "knowledge", title: "Conhecimento sempre por perto", text: "Explore os guias da plataforma.", href: "/conhecimento" }];
export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname(); const router = useRouter();
  const { state, me, update, theme, toggleTheme, storageError, signOut } = useAcademy();
  const [mobileOpen, setMobileOpen] = useState(false); const [noticesOpen, setNoticesOpen] = useState(false); const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setMobileOpen(false); setNoticesOpen(false); }, [path]);
  useEffect(() => { const handler = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key === "k") { event.preventDefault(); searchRef.current?.focus(); } if (event.key === "Escape") { setMobileOpen(false); setNoticesOpen(false); } }; document.addEventListener("keydown", handler); return () => document.removeEventListener("keydown", handler); }, []);
  const active = (href: string) => href === "/" ? path === "/" : path.startsWith(href);
  const title = [...navigation, { href: "/equipe", label: "Minha equipe" }, { href: "/admin", label: "Administração" }, { href: "/sobre", label: "Sobre esta versão" }].find(item => item.href !== "/" && active(item.href))?.label || "Visão geral";
  const unread = notices.filter(item => !state.readNotices.includes(item.id)).length;
  return <div className="app">
    <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>
    {mobileOpen && <button className="nav-scrim" aria-label="Fechar navegação" onClick={() => setMobileOpen(false)} />}
    <aside className={`sidebar ${mobileOpen ? "is-open" : ""}`} aria-label="Navegação principal">
    <Link href="/" className="brand" aria-label="DOC-Academy — início"><img className="brand-official" src="/doc-academy-logo-oficial.png" alt="DOC-Academy"/></Link>
      <div className="workspace-label"><span className="workspace-dot"/> DeMaria <span className="workspace-tag">INTERNO</span></div>
      <span className="nav-label">SEU ESPAÇO</span>
      <nav>{navigation.map(({ href, label, icon: Icon }) => <Link className={`nav-item ${active(href) ? "active" : ""}`} href={href} key={href} aria-current={active(href) ? "page" : undefined}><Icon size={19}/><span>{label}</span>{href === "/conhecimento" && <span className="nav-ai">IA</span>}</Link>)}</nav>
      {me.role !== "student" && <span className="nav-label manage-label">GESTÃO</span>}
      <nav>{me.role !== "student" && <Link href="/equipe" className={`nav-item ${active("/equipe") ? "active" : ""}`} aria-current={active("/equipe") ? "page" : undefined}><Users size={19}/> Minha equipe</Link>}{me.role === "admin" && <Link href="/admin" className={`nav-item ${active("/admin") ? "active" : ""}`} aria-current={active("/admin") ? "page" : undefined}><Settings2 size={19}/> Administração</Link>}</nav>
      <div className="sidebar-bottom"><div className="sidebar-note"><span className="little-star"><Sparkles size={17}/></span><strong>Conhecimento abre caminhos.</strong><p>Um novo aprendizado.<br/>Uma nova possibilidade.</p><Link href="/aprender">Explore os cursos <ArrowUpRight size={16}/></Link></div><Link className="help-link" href="/sobre"><CircleHelp size={17}/> Sobre a plataforma</Link><div className="sidebar-footer"><Link href="/" className="brand"><strong>DOC-<span>Academy</span></strong></Link></div></div>
    </aside>
    <div className="app-content"><header className="topbar"><div className="breadcrumb"><Button variant="ghost" size="icon" className="mobile-menu" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Abrir navegação" aria-expanded={mobileOpen}><Menu size={22}/></Button><span>Meu espaço</span><ChevronRight size={14}/><strong>{title}</strong></div>
      <form className="global-search" role="search" onSubmit={event => { event.preventDefault(); router.push(`/aprender?busca=${encodeURIComponent(search)}`); }}><Search size={17}/><input ref={searchRef} aria-label="Buscar cursos" placeholder="O que você quer aprender?" value={search} onChange={event => setSearch(event.target.value)}/></form>
      <div className="topbar-actions"><Link href="/sobre" className="demo-tag"><span/> Piloto interno</Link><Button variant="ghost" size="icon" onClick={toggleTheme} aria-label={theme === "light" ? "Ativar tema escuro" : "Ativar tema claro"}>{theme === "light" ? <Moon size={19}/> : <Sun size={19}/>}</Button><div className="notifications"><Button variant="ghost" size="icon" aria-label="Notificações" aria-expanded={noticesOpen} onClick={() => setNoticesOpen(!noticesOpen)}><Bell size={19}/>{unread > 0 && <span className="notification-dot"/>}</Button>{noticesOpen && <section className="notification-panel" aria-label="Novidades"><div className="section-title"><h3>Novidades</h3><Button size="icon" variant="ghost" aria-label="Fechar notificações" onClick={() => setNoticesOpen(false)}><X size={16}/></Button></div>{notices.map(item => <Link href={item.href} key={item.id} onClick={() => { update(current => ({ ...current, readNotices: Array.from(new Set([...current.readNotices, item.id])) })); setNoticesOpen(false); }}><span className="notification-symbol"><Sparkles size={16}/></span><span><strong>{item.title}</strong><small>{item.text}</small></span>{!state.readNotices.includes(item.id) && <i/>}</Link>)}</section>}</div><span className="topbar-divider"/><Link href="/conquistas" className="profile" aria-label="Ver minha evolução"><span className="avatar avatar-daniel">{me.name.slice(0,1)}</span><span><strong>{me.name.split(" ")[0]}</strong><small>Meu aprendizado</small></span></Link><Link className="help-link" href="/acesso">Minha senha</Link><Button variant="ghost" onClick={signOut}>Sair</Button></div></header>
      {storageError && <div className="storage-warning" role="alert">Não foi possível atualizar os dados do servidor. Confira sua conexão e tente novamente.</div>}
      <main id="conteudo" className="main-content">{children}</main><footer className="main-footer"><span>DOC-Academy <span>·</span> Feito para evoluir com você.</span><span>Ambiente interno · progresso salvo na sua conta</span></footer>
    </div>
  </div>;
}
