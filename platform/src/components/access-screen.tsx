"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Eye, EyeOff, LockKeyhole, ShieldAlert, UserPlus } from "lucide-react";
import { browserAuth } from "@/lib/supabase-browser";
import { DEPARTMENTS } from "@/lib/departments";
import { MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH, newPasswordSchema } from "@/lib/auth-policy";

export function AccessScreen({ configured, signedIn }: { configured: boolean; signedIn: boolean }) {
  const router = useRouter();
  const [portal, setPortal] = useState<"colaborador" | "cartorio">("cartorio");
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    const auth = browserAuth();
    if (!auth) return;
    setBusy(true);

    try {
      if (signedIn) {
        if (password !== confirmation) throw new Error("As senhas precisam ser iguais.");
        const validPassword = newPasswordSchema.safeParse(password);
        if (!validPassword.success) throw new Error(validPassword.error.issues[0]?.message);
        const result = await auth.auth.updateUser({ password });
        if (result.error) throw result.error;
        setPassword("");
        setConfirmation("");
        router.replace("/");
      } else if (mode === "signup") {
        if (!name.trim()) throw new Error("Informe seu nome completo.");
        if (password !== confirmation) throw new Error("As senhas digitadas não coincidem.");
        const validPassword = newPasswordSchema.safeParse(password);
        if (!validPassword.success) throw new Error(validPassword.error.issues[0]?.message);

        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            department,
            email: email.trim(),
            password,
          }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Não foi possível realizar o cadastro.");

        setMessage({
          type: "success",
          text: "Cadastro realizado com sucesso! Sua conta está aguardando liberação do administrador. Fale com Daniel para ativar seu acesso.",
        });
        setMode("login");
        setPassword("");
        setConfirmation("");
      } else if (mode === "forgot") {
        const result = await auth.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/acesso`,
        });
        if (result.error) throw result.error;
        setMessage({
          type: "success",
          text: "Se este e-mail estiver cadastrado, você receberá as instruções para definir uma nova senha.",
        });
      } else {
        const result = await auth.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (result.error) throw new Error("Não foi possível entrar. Confira seu e-mail e senha.");
        setPassword("");
        router.replace("/");
      }
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Não foi possível concluir. Tente novamente.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="access-page">
      <section className="access-story">
        <a className="brand" href="/">
          <strong>
            DOC-<span>Academy</span>
          </strong>
        </a>
        <span className="hero-eyebrow">DEMARIA · CONHECIMENTO QUE TRANSFORMA</span>
        <h1>
          Seu próximo nível
          <br />
          começa <em>aqui.</em>
        </h1>
        <p>Um espaço para aprender, compartilhar descobertas e evoluir com a sua equipe.</p>
        <div className="hero-gem">
          <LockKeyhole size={70} strokeWidth={1} />
        </div>
      </section>

      <section className="panel access-card">
        <img className="access-logo" src="/doc-academy-logo-oficial.png" alt="DOC-Academy" width={180} height={120} />
        <span className="eyebrow">SUA JORNADA NA DOC-ACADEMY</span>
        <h2>
          {!configured
            ? "Estamos preparando seu acesso"
            : signedIn
            ? "Defina sua senha"
            : mode === "signup"
            ? "Crie sua conta"
            : mode === "forgot"
            ? "Recupere seu acesso"
            : "Bom ter você por aqui."}
        </h2>
        <p>
          {!configured
            ? "O administrador precisa concluir a configuração do Supabase neste ambiente."
            : signedIn
            ? "Escolha uma senha pessoal para acessar seus cursos."
            : mode === "signup"
            ? "Cadastre seus dados para solicitar acesso à plataforma."
            : mode === "forgot"
            ? "Informe seu e-mail de trabalho para receber as instruções de recuperação."
            : "Entre com seu e-mail e senha para continuar aprendendo."}
        </p>

        {message && (
          <div
            role={message.type === "error" ? "alert" : "status"}
            className={message.type === "error" ? "form-error" : "info-note"}
            style={{
              marginBottom: "16px",
              display: "flex",
              alignItems: "flex-start",
              gap: "8px",
              background: message.type === "success" ? "#eefaf6" : undefined,
              borderColor: message.type === "success" ? "#bcebdc" : undefined,
              color: message.type === "success" ? "#236d55" : undefined,
            }}
          >
            {message.type === "error" ? (
              <ShieldAlert size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            ) : (
              <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {!signedIn && (
          <div className="portal-toggle-tabs">
            <button
              type="button"
              aria-pressed={portal === "colaborador"}
              className={`portal-tab-btn ${portal === "colaborador" ? "active" : ""}`}
              onClick={() => {
                setPortal("colaborador");
                setMessage(null);
              }}
            >
              Colaborador DeMaria
            </button>
            <button
              type="button"
              aria-pressed={portal === "cartorio"}
              className={`portal-tab-btn ${portal === "cartorio" ? "active" : ""}`}
              onClick={() => {
                setPortal("cartorio");
                setMode("login");
                setMessage(null);
              }}
            >
              Cliente do Cartório
            </button>
          </div>
        )}

        {configured && (
          <form onSubmit={submit}>
            {!signedIn && mode === "signup" && (
              <label className="field">
                <span>Nome completo</span>
                <input
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  placeholder="Seu nome e sobrenome"
                />
              </label>
            )}

            {!signedIn && mode === "signup" && (
              <label className="field"><span>Seu setor</span>
                <select required value={department} onChange={e => setDepartment(e.target.value)}>
                  <option value="">Selecione seu setor</option>
                  {DEPARTMENTS.map(item => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
            )}
            {!signedIn && (
              <label className="field">
                <span>{portal === "cartorio" ? "E-mail credenciado da serventia" : "E-mail corporativo"}</span>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder={portal === "cartorio" ? "ex: titular@cartoriosp.com.br" : "voce@sacdemaria.com.br"}
                  title={portal === "cartorio" ? "E-mail cadastrado pela DeMaria para o cartório" : "Use um e-mail @demaria.com.br ou @sacdemaria.com.br"}
                />
              </label>
            )}

            {(mode !== "forgot" || signedIn) && (
              <div className="field">
                <label htmlFor="access-password">{signedIn || mode === "signup" ? `Senha (mínimo ${MIN_PASSWORD_LENGTH} caracteres)` : "Senha"}</label>
                <div className="access-password-wrap">
                <input
                  id="access-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={signedIn || mode === "signup" ? "new-password" : "current-password"}
                  minLength={signedIn || mode === "signup" ? MIN_PASSWORD_LENGTH : undefined}
                  maxLength={signedIn || mode === "signup" ? MAX_PASSWORD_LENGTH : undefined}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder={mode === "signup" ? `Pelo menos ${MIN_PASSWORD_LENGTH} caracteres` : undefined}
                />
                <button type="button" className="access-password-toggle" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} aria-pressed={showPassword} aria-controls="access-password">
                  {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                </button>
                </div>
              </div>
            )}

            {(signedIn || mode === "signup") && (
              <div className="field">
                <label htmlFor="access-confirmation">Confirme a senha</label>
                <div className="access-password-wrap">
                <input
                  id="access-confirmation"
                  type={showConfirmation ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={MIN_PASSWORD_LENGTH}
                  maxLength={MAX_PASSWORD_LENGTH}
                  value={confirmation}
                  onChange={e => setConfirmation(e.target.value)}
                  required
                  placeholder="Digite a senha novamente"
                />
                <button type="button" className="access-password-toggle" onClick={() => setShowConfirmation(value => !value)} aria-label={showConfirmation ? "Ocultar confirmação da senha" : "Mostrar confirmação da senha"} aria-pressed={showConfirmation} aria-controls="access-confirmation">
                  {showConfirmation ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                </button>
                </div>
              </div>
            )}

            <button className="button button-primary" type="submit" disabled={busy} style={{ width: "100%", marginTop: "12px" }}>
              {busy
                ? "Aguarde…"
                : signedIn
                ? "Salvar senha e entrar"
                : mode === "signup"
                ? "Criar conta e solicitar acesso"
                : mode === "forgot"
                ? "Enviar instruções"
                : "Entrar na minha jornada"}
              <ArrowRight size={16} />
            </button>

            {!signedIn && (
              <div className="access-actions">
                {mode === "login" ? (
                  <>
                    {portal === "colaborador" && (
                      <button
                        type="button"
                        className="button button-ghost"
                        onClick={() => {
                          setMode("signup");
                          setMessage(null);
                        }}
                      >
                        <UserPlus size={14} style={{ marginRight: 5 }} />
                        Primeiro acesso? Crie sua conta
                      </button>
                    )}
                    <button
                      type="button"
                      className="button button-ghost"
                      onClick={() => {
                        setMode("forgot");
                        setMessage(null);
                      }}
                    >
                      Esqueci a senha
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="button button-ghost"
                    style={{ width: "100%" }}
                    onClick={() => {
                      setMode("login");
                      setMessage(null);
                    }}
                  >
                    ← Já possui cadastro? Fazer login
                  </button>
                )}
              </div>
            )}
          </form>
        )}

        <div className="info-note" style={{ marginTop: "20px" }}>
          {portal === "cartorio"
            ? "O cadastro do cartório e credenciamento do usuário-chave são realizados pela equipe administrativa da DeMaria. A certificação oficial é emitida nesta plataforma após a conclusão da trilha."
            : "Novos cadastros de colaboradores passam por aprovação de um administrador antes da liberação do catálogo."}
        </div>
      </section>
    </main>
  );
}
