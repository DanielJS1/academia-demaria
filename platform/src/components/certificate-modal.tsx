"use client";

import { useEffect } from "react";
import { Award, CheckCircle2, Download, Printer, ShieldCheck, X } from "lucide-react";
import { Button } from "./ui/button";
import type { Cartorio } from "@/lib/model";
import { formatModuleName } from "@/lib/cartorio-modules";

interface CertificateModalProps {
  studentName: string;
  cartorio: Cartorio;
  isOpen: boolean;
  onClose: () => void;
  completionDate?: string;
}

export function CertificateModal({
  studentName,
  cartorio,
  isOpen,
  onClose,
  completionDate,
}: CertificateModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const dateFormatted = completionDate
    ? new Date(completionDate).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : new Date().toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });

  const certHash = `DM-${cartorio.uf}-${cartorio.id.slice(0, 4).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="cert-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cert-modal-title"
      onClick={onClose}
    >
      <div className="cert-modal-dialog" onClick={event => event.stopPropagation()}>
        <div className="cert-modal-actions no-print">
          <Button variant="secondary" onClick={handlePrint}>
            <Printer size={16} /> Imprimir / Salvar PDF
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar certificado">
            <X size={20} />
          </Button>
        </div>

        <div className="certificate-frame">
          <div className="cert-border">
            <div className="cert-inner-border">
              {/* Header */}
              <header className="cert-header">
                <div className="cert-brand">
                  <strong>
                    DOC-<span>Academy</span>
                  </strong>
                  <span className="cert-partner-tag">DeMaria Tecnologia Notarial</span>
                </div>
                <div className="cert-badge">
                  <ShieldCheck size={44} strokeWidth={1.5} />
                </div>
              </header>

              {/* Title */}
              <div className="cert-title-block">
                <span className="cert-pretitle">CERTIFICADO DE CAPACITAÇÃO & CERTIFICAÇÃO OFICIAL</span>
                <h1 id="cert-modal-title">Certificado de Proficiência</h1>
                <p>Por cumprimento integral do programa de capacitação técnica operacional.</p>
              </div>

              {/* Student info */}
              <div className="cert-recipient-block">
                <span className="cert-label">Certificamos com distinção que</span>
                <div className="cert-name">{studentName || "Profissional do Cartório"}</div>
                <div className="cert-cartorio">
                  representante credenciado de <strong>{cartorio.name}</strong> · {cartorio.city ? `${cartorio.city} — ` : ""}{cartorio.uf}
                  {cartorio.cns ? ` (CNS: ${cartorio.cns})` : ""}
                </div>
              </div>

              {/* Description */}
              <p className="cert-statement">
                Concluiu com aproveitamento a trilha técnica oficial dos sistemas DeMaria, demonstrando proficiência
                operacional, conformidade com os provimentos do Tribunal de Justiça e domínio das ferramentas contratadas.
              </p>

              {/* Modules list */}
              <div className="cert-modules-section">
                <span className="cert-modules-title">MÓDULOS CONTRATADOS & CAPACITADOS:</span>
                <div className="cert-modules-grid">
                  {cartorio.modules.map(modKey => (
                    <span key={modKey} className="cert-module-chip">
                      <CheckCircle2 size={12} />
                      {formatModuleName(modKey)}
                    </span>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <footer className="cert-footer">
                <div className="cert-signature-col">
                  <div className="cert-sig-line">
                    <span className="cert-sig-name">Daniel José</span>
                    <small>Coordenação Geral DOC-Academy</small>
                  </div>
                </div>

                <div className="cert-auth-col">
                  <div className="cert-seal">
                    <Award size={32} />
                    <span>CERTIFICAÇÃO OFICIAL</span>
                  </div>
                  <div className="cert-auth-code">
                    <small>CÓDIGO DE AUTENTICIDADE:</small>
                    <code>{certHash}</code>
                  </div>
                  <div className="cert-date">Emitido em {dateFormatted}</div>
                </div>

                <div className="cert-signature-col">
                  <div className="cert-sig-line">
                    <span className="cert-sig-name">DeMaria Tecnologia</span>
                    <small>Diretoria de Treinamento & Implantações</small>
                  </div>
                </div>
              </footer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
