"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface AnimatedButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  href?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * AnimatedButton — Botão com borda animada de gradiente rotativo (conic-gradient)
 * nas cores institucionais do DOC-Academy (Mint, Indigo e Sky).
 */
export function AnimatedButton({
  href,
  children,
  className,
  ...props
}: AnimatedButtonProps) {
  const content = (
    <span className="animated-btn-inner">
      {children}
    </span>
  );

  if (href) {
    return (
      <Link href={href} className={cn("animated-btn-wrapper group", className)}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" className={cn("animated-btn-wrapper group", className)} {...props}>
      {content}
    </button>
  );
}
