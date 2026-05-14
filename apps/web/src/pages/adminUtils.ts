import type { CSSProperties } from "react";
import { backendUrl, isTauriApp } from "../main";

export const BACKEND = backendUrl;

export const hdrs = (): Record<string, string> => {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const token = localStorage.getItem("tentacle_token");
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
};

/** credentials option: use cookies on web, nothing on desktop (token is in header) */
export const creds = (): RequestCredentials | undefined =>
  isTauriApp ? undefined : "include";

/**
 * Tokens visuels admin alignés sur le MASTER design-system.
 * - CTA Netflix : pill blanc + halo violet signature (bp + bpStyle inline)
 * - Buttons height 44 (h-11), touch target ≥ 44pt garanti
 * - Tokens-only : aucune valeur hex hardcodée (var(--brand), var(--status-*))
 */
export const cls = {
  // Card layouts (radius 12, border subtle, surface white/3)
  card: "mb-8 rounded-xl border border-white/[0.06] bg-white/[0.03] p-6",
  sub: "rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 space-y-3",

  // Inputs (height 44, focus ring violet)
  inp: "w-full h-11 rounded-lg bg-white/[0.06] border border-white/[0.08] px-3 text-sm text-white outline-none transition focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/30 placeholder:text-white/35",
  lbl: "mb-1 block text-xs font-medium text-white/60",

  // CTA primary (Netflix — white pill + halo violet via bpStyle inline)
  bp: "inline-flex items-center justify-center gap-2 h-11 px-5 rounded-lg bg-white text-black text-sm font-bold transition-all hover:bg-white/90 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0",
  bpStyle: { boxShadow: "0 8px 22px rgba(139,92,246,0.45)" } as CSSProperties,

  // CTA secondary (gris translucide)
  bs: "inline-flex items-center justify-center gap-2 h-11 px-5 rounded-lg bg-white/10 border border-white/[0.08] text-white/90 text-sm font-semibold transition hover:bg-white/15 disabled:opacity-50 disabled:cursor-not-allowed",

  // CTA brand (violet ghost) — actions intermédiaires non-CTA primaire
  bbrand: "inline-flex items-center justify-center gap-2 h-11 px-5 rounded-lg bg-[var(--brand-soft)] border border-[var(--brand)]/35 text-white text-sm font-semibold transition hover:bg-[var(--brand)]/25 disabled:opacity-50 disabled:cursor-not-allowed",

  // CTA danger (surface error tokenisée)
  bd: "inline-flex items-center justify-center gap-2 h-11 px-5 rounded-lg bg-[var(--status-error-bg)] border border-[var(--status-error)]/30 text-[var(--status-error-fg)] text-sm font-semibold transition hover:bg-[var(--status-error)]/25 disabled:opacity-50 disabled:cursor-not-allowed",

  // Status pill / chip
  chip: "inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-[11px] font-semibold tracking-wide",
};
