"use client";
import Link from "next/link";
import { ArrowRight, CalendarDays, PlayCircle, Radio } from "lucide-react";
import { useLive } from "./live-provider";
import { LiveBadge } from "./live-badge";
import { liveDate, liveHref, liveStatusLabels, type LiveEvent } from "@/lib/live-events";

function EventCard({ event }: { event: LiveEvent }) {
  return <Link className={`live-event-card${event.status === "live" ? " is-live" : ""}`} href={liveHref(event.id)}>
    <div className="live-event-card-top">{event.status === "live" ? <LiveBadge /> : <span className="live-status"><CalendarDays size={14} aria-hidden="true" />{liveStatusLabels[event.status]}</span>}<span>{event.host}</span></div>
    <h3>{event.title}</h3><p>{event.description || "Um encontro para aprender, perguntar e compartilhar experiências."}</p>
    <div className="live-event-card-bottom"><span>{liveDate(event.scheduledAt)} · Brasília</span><strong>{event.status === "recorded" ? "Assistir gravação" : event.status === "live" ? "Participar agora" : "Ver aula"}<ArrowRight size={16} aria-hidden="true" /></strong></div>
  </Link>;
}
export function LiveCatalog() {
  const { data, error, loading, reload } = useLive();
  const [onAir, upcoming, recordings] = [
    data.events.filter(event => event.status === "live"),
    data.events.filter(event => event.status === "scheduled").sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)),
    data.events.filter(event => ["recorded", "processing"].includes(event.status)).sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt)),
  ];
  if (error) return <div className="live-inline-error" role="status">As aulas ao vivo não puderam ser carregadas.<button type="button" onClick={reload}>Tentar novamente</button></div>;
  if (loading || !data.events.length) return null;
  return <div className="live-catalog" id="aulas-ao-vivo">
    {([{ title: "Ao vivo agora", hint: "A aula já começou. Entre e faça parte da conversa.", icon: Radio, events: onAir },
      { title: "Próximos encontros", hint: "Reserve um momento para aprender com a gente.", icon: CalendarDays, events: upcoming },
      { title: "Assista no seu tempo", hint: "Encontros que continuam disponíveis para você.", icon: PlayCircle, events: recordings }]).filter(group => group.events.length).map(group =>
      <section key={group.title} aria-label={group.title}><div className="live-section-heading"><span><group.icon size={20} aria-hidden="true" /><h2>{group.title}</h2></span><p>{group.hint}</p></div>
        <div className="live-event-grid">{group.events.map(event => <EventCard key={event.id} event={event} />)}</div>
      </section>)}
  </div>;
}
