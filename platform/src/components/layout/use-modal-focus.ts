"use client";
import { useEffect, useRef } from "react";

/** Keyboard containment for the existing profile overlays, with trigger restoration. */
export function useModalFocus(open: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const targets = () => Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')).filter(element => element.getClientRects().length > 0);
    const focusFirst = () => (targets()[0] ?? dialog).focus();
    const contain = (event: FocusEvent) => { if (event.target instanceof Node && !dialog.contains(event.target)) focusFirst(); };
    const cycle = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const list = targets(), first = list[0], last = list[list.length - 1];
      if (!first) { event.preventDefault(); dialog.focus(); }
      else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    focusFirst();
    document.addEventListener("focusin", contain);
    dialog.addEventListener("keydown", cycle);
    return () => { document.removeEventListener("focusin", contain); dialog.removeEventListener("keydown", cycle); if (trigger?.isConnected) trigger.focus(); };
  }, [open]);
  return ref;
}
