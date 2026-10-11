"use client";

import { useState } from "react";
import { X } from "lucide-react";

export function LessonCompletionOverlay({ visible, preview, completed, nextTitle, onNext }: {
  visible: boolean;
  preview: boolean;
  completed: boolean;
  nextTitle?: string;
  onNext?: () => void;
}) {
  const [dismissed, setDismissed] = useState(false);
  if (!visible || dismissed) return null;

  return (
    <section className="video-next-action" aria-label="Conclusão da aula">
      <button type="button" className="video-next-dismiss" aria-label="Fechar aviso de conclusão" onClick={() => setDismissed(true)}><X size={18} /></button>
      <div role="status">
        <strong>{preview ? "Final da prévia" : completed ? "Aula concluída!" : "Final do vídeo"}</strong>
        <p>{!preview && !completed ? "Para concluir, assista a pelo menos 50% da aula e chegue ao final. Administradores precisam apenas chegar ao final." : nextTitle ? `A seguir: ${nextTitle}` : "Você chegou à última aula deste curso."}</p>
      </div>
      {onNext && <button type="button" className="button button-primary" disabled={!preview && !completed} onClick={onNext}>Próxima aula →</button>}
    </section>
  );
}
