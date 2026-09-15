import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export const cn = (...values: ClassValue[]) => twMerge(clsx(values));
export const number = (value: number) => value.toLocaleString("pt-BR");
export const initials = (name: string) => name.split(" ").filter(Boolean).slice(0, 2).map(word => word[0]).join("").toUpperCase();
export const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export const csvCell = (value: string | number) => { const text = String(value); return '"' + ((/^\s*[=+@-]/.test(text) ? "'" : "") + text).replaceAll('"', '""') + '"'; };
