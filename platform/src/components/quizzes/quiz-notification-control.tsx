"use client";
import { useState } from "react";
import { Bell } from "lucide-react";
import { useAcademy } from "../academy-provider";
import { Button } from "../ui/button";

export function QuizNotificationControl() {
  const { state, mutate, busy, simulatedCartorioId } = useAcademy();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const enabled = state.quizNotifications?.enabled ?? false;
  if (simulatedCartorioId) return null;
  const change = async () => {
    setSaving(true); setMessage(""); setFailed(false);
    const ok = await mutate({ type: "quiz-notifications", enabled: !enabled });
    setSaving(false); setFailed(!ok);
    setMessage(ok ? enabled ? "Avisos cancelados. Você pode habilitá-los novamente quando quiser." : "Avisos habilitados. Novas publicações aparecerão no sino da plataforma."
      : "Não foi possível alterar os avisos. Sua preferência anterior foi preservada. Tente novamente.");
  };
  return <section className="panel quiz-notification-control" aria-labelledby="quiz-notification-title" aria-busy={saving}>
    <div><h2 id="quiz-notification-title"><Bell size={18} aria-hidden="true"/> Avisar sobre novos desafios</h2>
      <p>{enabled ? "Ativado: os avisos aparecerão no sino da plataforma enquanto o desafio estiver disponível." : "Receba no sino da plataforma avisos de desafios publicados após sua adesão."}</p>
      {message && <p role={failed ? "alert" : "status"}>{message}</p>}</div>
    <Button type="button" variant={enabled ? "secondary" : "default"} disabled={busy || saving} onClick={() => void change()}>{saving ? "Salvando…" : enabled ? "Cancelar avisos" : "Habilitar avisos"}</Button>
  </section>;
}
