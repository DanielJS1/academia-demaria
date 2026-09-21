"use client";

import { useState, useRef, useEffect } from "react";
import { Camera, Upload, Trash2, X, AlertCircle } from "lucide-react";
import { useAcademy } from "./academy-provider";
import { processImageFileToBase64 } from "@/lib/avatar-helper";
import { Button } from "./ui/button";

interface ProfilePhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProfilePhotoModal({ isOpen, onClose }: ProfilePhotoModalProps) {
  const { me, avatar, setAvatar, notify } = useAcademy();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Fechar ao pressionar Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setErrorMessage("");

    try {
      const base64 = await processImageFileToBase64(file, 200);
      const ok = await setAvatar(base64);
      if (ok) {
        notify("Foto de perfil atualizada em todos os navegadores!");
        onClose();
      } else {
        setErrorMessage("Não foi possível salvar a foto no servidor.");
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Falha ao processar a imagem.");
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemovePhoto = async () => {
    setLoading(true);
    try {
      const ok = await setAvatar(null);
      if (ok) {
        notify("Foto de perfil removida.");
        onClose();
      } else {
        setErrorMessage("Não foi possível remover a foto do servidor.");
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Falha ao remover a foto.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="profile-photo-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="profile-photo-title">
      <div className="profile-photo-modal" onClick={(e) => e.stopPropagation()}>
        <div className="profile-photo-header">
          <div className="profile-photo-title-wrap">
            <span className="profile-photo-icon-badge"><Camera size={18} /></span>
            <h3 id="profile-photo-title">Foto de Perfil</h3>
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

        <div className="profile-photo-body">
          <div className="profile-photo-preview-wrap">
            <div className="profile-photo-preview">
              {avatar ? (
                <img src={avatar} alt={me?.name || "Foto de perfil"} className="profile-photo-img" />
              ) : (
                <span className="profile-photo-initial">
                  {me?.name ? me.name.slice(0, 1).toUpperCase() : "U"}
                </span>
              )}
            </div>
            <span className="profile-photo-name">{me?.name}</span>
            <span className="profile-photo-dept">{me?.department || "DOC-Academy"}</span>
          </div>

          {errorMessage && (
            <div className="profile-photo-error" role="alert">
              <AlertCircle size={15} />
              <span>{errorMessage}</span>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png, image/jpeg, image/webp"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />

          <div className="profile-photo-actions">
            <Button
              variant="mint"
              className="profile-photo-btn"
              disabled={loading}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={16} />
              <span>{loading ? "Processando..." : avatar ? "Alterar foto" : "Escolher foto"}</span>
            </Button>

            {avatar && (
              <Button
                variant="ghost"
                className="profile-photo-remove-btn"
                disabled={loading}
                onClick={handleRemovePhoto}
              >
                <Trash2 size={15} />
                <span>Remover foto</span>
              </Button>
            )}
          </div>

          <p className="profile-photo-hint">
            Sua foto fica salva no seu perfil e visível para a equipe em <strong>qualquer navegador e dispositivo</strong>.
          </p>
        </div>
      </div>
    </div>
  );
}
