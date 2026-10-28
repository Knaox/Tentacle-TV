/**
 * Octave (mobile) — le SOUS-TITRE vivant de l'entrée « Hors ligne » du hub « Compte », règle PURE
 * (`offlineEntryHint.test.ts`) : « 3 en transfert · 42 % », une pause, un défaut, sinon la phrase de repos.
 * Lit le résumé des transferts de la page Hors ligne (`useKeptTransferSummary`, o3) — seulement ses champs.
 */

export interface TransferSummaryView {
  active: boolean;
  done: number;
  total: number;
  running: number;
  pausedByUser: number;
  failed: number;
  /** 0..1. */
  fraction: number;
}

export type OfflineEntryHint =
  | { kind: "idle" }
  | { kind: "running"; left: number; percent: number }
  | { kind: "paused"; count: number }
  | { kind: "failed"; count: number };

export function offlineEntryHint(summary: TransferSummaryView | null): OfflineEntryHint {
  if (!summary?.active) return { kind: "idle" };
  if (summary.running > 0) {
    const percent = Math.min(100, Math.max(0, Math.floor(summary.fraction * 100)));
    return { kind: "running", left: Math.max(0, summary.total - summary.done), percent };
  }
  // Rien ne tourne : le défaut d'abord (il demande un geste), puis la pause de l'utilisateur.
  if (summary.failed > 0) return { kind: "failed", count: summary.failed };
  if (summary.pausedByUser > 0) return { kind: "paused", count: summary.pausedByUser };
  return { kind: "idle" };
}
