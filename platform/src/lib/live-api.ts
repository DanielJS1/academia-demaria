"use client";
import { browserAuth } from "./supabase-browser";
export class LiveApiError extends Error { constructor(message: string, public status: number) { super(message); } }

export async function liveApi<T>(path: string, method = "GET", payload?: unknown, signal?: AbortSignal): Promise<T> {
  const session = (await browserAuth()?.auth.getSession())?.data.session;
  if (!session) throw new Error("Entre na sua conta para acessar as aulas ao vivo.");
  const response = await fetch(`/api/live${path}`, {
    method, headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
    ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}), cache: "no-store", signal,
  });
  const body = await response.json();
  if (!response.ok) throw new LiveApiError(body.error || "Não foi possível conectar. Tente novamente.", response.status);
  return body as T;
}
