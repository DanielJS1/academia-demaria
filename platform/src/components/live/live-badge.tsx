export function LiveBadge({ compact = false }: { compact?: boolean }) {
  return <span className={`live-badge${compact ? " live-badge--compact" : ""}`}><span aria-hidden="true" />AO VIVO</span>;
}
