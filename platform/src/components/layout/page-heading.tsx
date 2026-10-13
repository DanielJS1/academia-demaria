import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type PageHeadingProps = {
  eyebrow?: string; title: string; description: string; children?: ReactNode;
  variant?: "default" | "compact";
};

export function PageHeading({ eyebrow, title, description, children, variant = "default" }: PageHeadingProps) {
  return <div className={cn("page-heading", variant === "compact" && "page-heading-compact")}>
    <div className="page-heading-copy">{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1><p>{description}</p></div>
    {children && <div className="heading-actions">{children}</div>}
  </div>;
}
