"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, GraduationCap, ShieldCheck, Users } from "lucide-react";
import { browserAuth } from "@/lib/supabase-browser";

const profiles = [
  { id: "admin", title: "Administrador", description: "Visão completa", icon: ShieldCheck },
  { id: "gestor", title: "Gestor", description: "Equipe e relatórios", icon: Users },
  { id: "colaborador", title: "Colaborador", description: "Cursos e evolução", icon: GraduationCap },
  { id: "cartorio", title: "Cartório", description: "Área do cliente", icon: Building2 },
];

export function DemoAccess() {
  const router = useRouter();
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_APP_ENV !== "homologacao") return;
    const abort = new AbortController();
    void fetch("/api/auth/demo", { signal: abort.signal, cache: "no-store" })
      .then(response => response.ok ? response.json() : { enabled: false })
      .then(data => { if (!abort.signal.aborted) setEnabled(data.enabled === true); }).catch(() => {});
    return () => abort.abort();
  }, []);
  if (!enabled) return null;
  async function enter(profile: string) {
    setBusy(profile); setError("");
    try {
      const response = await fetch("/api/auth/demo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      const auth = browserAuth();
      if (!auth) throw new Error("A demonstração está indisponível.");
      const result = await auth.auth.setSession(data);
      if (result.error) throw new Error("Não foi possível abrir a demonstração.");
      router.replace("/");
    } catch (e) { setError(e instanceof Error ? e.message : "Tente novamente."); }
    finally { setBusy(null); }
  }
  return <section className="access-demo" aria-labelledby="access-demo-title">
    <h3 id="access-demo-title">Explore a demonstração</h3>
    <p>Escolha um perfil fictício para entrar sem senha.</p>
    <div className="access-demo-options">{profiles.map(({ id, title, description, icon: Icon }) =>
      <button key={id} type="button" disabled={busy !== null} className="access-demo-option" aria-label={`Entrar na demonstração como ${title}`} onClick={() => void enter(id)}>
        <Icon size={20} aria-hidden="true" /><span><strong>{title}</strong><small>{description}</small></span>
      </button>)}</div>
    {busy && <p role="status">Abrindo demonstração…</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <p className="access-demo-divider">Ou entre com seu e-mail e senha</p>
  </section>;
}
