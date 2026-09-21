export const ENGAGEMENT_TIME_ZONE = "America/Sao_Paulo";
export const ENGAGEMENT_IDLE_MS = 120_000;
export const ENGAGEMENT_HEARTBEAT_MS = 60_000;

export type EngagementMember = {
  userId: string;
  lastAccessAt: string | null;
  activeDays: number;
  activeSeconds: number;
  daily: { date: string; activeSeconds: number }[];
};
export type EngagementReport = {
  windowDays: 7 | 30;
  collectedSince: string;
  generatedAt: string;
  members: EngagementMember[];
};

export function formatActiveTime(seconds: number): string {
  if (seconds < 60) return seconds > 0 ? "< 1 min" : "0 min";
  const minutes = Math.floor(seconds / 60);
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h ${minutes % 60}min`;
}

export function formatLastAccess(value: string | null | undefined): string {
  return value ? new Intl.DateTimeFormat("pt-BR", {
    timeZone: ENGAGEMENT_TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(value)) : "Sem registro";
}
