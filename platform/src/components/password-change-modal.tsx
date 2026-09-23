"use client";

import { useState, useEffect, useRef } from "react";
import { KeyRound, Eye, EyeOff, Lock, X, AlertCircle, CheckCircle2 } from "lucide-react";
import { browserAuth } from "@/lib/supabase-browser";
import { useAcademy } from "./academy-provider";
import { Button } from "./ui/button";
import { MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH, newPasswordSchema } from "@/lib/auth-policy";

interface PasswordChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PasswordChangeModal({ isOpen, onClose }: PasswordChangeModalProps) {
  const { notify } = useAcademy();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setPassword("");
    setConfirmation("");
    setErrorMessage("");
    setSuccessMessage("");
    setShowPassword(false);
    setShowConfirmation(false);

    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!password) {
      setErrorMessage("Informe a nova senha.");
      return;
    }

    const validPassword = newPasswordSchema.safeParse(password);
    if (!validPassword.success) {
      setErrorMessage(validPassword.error.issues[0]?.message || "Senha inválida.");
      return;
    }

    if (password !== confirmation) {
      setErrorMessage("As senhas digitadas não conferem.");
      return;
    }

    const auth = browserAuth();
    if (!auth) {
      setErrorMessage("Serviço de autenticação indisponível no momento.");
      return;
    }

    setLoading(true);

    try {
      const { error } = await auth.auth.updateUser({ password });
      if (error) {
        throw error;
      }

      setSuccessMessage("Senha alterada com sucesso!");
      notify("Senha atualizada com sucesso!");
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Não foi possível atualizar a senha. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="profile-photo-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="password-modal-title"
    >
      <div className="profile-photo-modal password-change-card" onClick={(e) => e.stopPropagation()}>
        <div className="profile-photo-header">
          <div className="profile-photo-title-wrap">
            <span className="profile-photo-icon-badge">
              <KeyRound size={18} />
            </span>
            <h3 id="password-modal-title">Alterar Minha Senha</h3>
          </div>
          <button
            type="button"
            className="profile-photo-close-btn"
            onClick={onClose}
            aria-label="Fechar janela"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="password-change-form">
          <p className="password-change-description">
            Defina uma senha segura com no mínimo <strong>{MIN_PASSWORD_LENGTH} caracteres</strong>. Ela será necessária no seu próximo login.
          </p>

          {errorMessage && (
            <div className="profile-photo-error" role="alert">
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div
              className="info-note"
              style={{
                marginBottom: "16px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: "#eefaf6",
                borderColor: "#bcebdc",
                color: "#236d55",
                fontSize: "12px",
                padding: "8px 12px",
                borderRadius: "8px",
              }}
            >
              <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
              <span>{successMessage}</span>
            </div>
          )}

          <div className="password-input-group">
            <label htmlFor="new-password">Nova Senha</label>
            <div className="password-input-wrap">
              <input
                id="new-password"
                ref={inputRef}
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={`Mínimo de ${MIN_PASSWORD_LENGTH} caracteres`}
                minLength={MIN_PASSWORD_LENGTH}
                maxLength={MAX_PASSWORD_LENGTH}
                autoComplete="new-password"
                disabled={loading}
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Ocultar senha" : "Ver senha"}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="password-input-group">
            <label htmlFor="confirm-password">Confirmar Nova Senha</label>
            <div className="password-input-wrap">
              <input
                id="confirm-password"
                type={showConfirmation ? "text" : "password"}
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                placeholder="Repita a senha digitada"
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
                maxLength={MAX_PASSWORD_LENGTH}
                disabled={loading}
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowConfirmation(!showConfirmation)}
                aria-label={showConfirmation ? "Ocultar confirmação" : "Ver confirmação"}
                aria-pressed={showConfirmation}
              >
                {showConfirmation ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="password-modal-actions">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="mint"
              disabled={loading || !password || !confirmation}
            >
              <Lock size={15} />
              <span>{loading ? "Salvando..." : "Salvar Nova Senha"}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
