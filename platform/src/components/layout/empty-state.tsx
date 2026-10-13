import type { ReactNode } from "react";
import { BookOpen } from "lucide-react";

export function EmptyState({ icon = <BookOpen size={28} aria-hidden="true" />, title, description, children }: {
  icon?: ReactNode; title: string; description: string; children?: ReactNode;
}) {
  return <div className="empty-state"><span className="empty-icon" aria-hidden="true">{icon}</span><h2>{title}</h2><p>{description}</p>{children}</div>;
}
