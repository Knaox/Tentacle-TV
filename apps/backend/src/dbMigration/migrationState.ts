import type { MigrationFailureReason } from "./migrationErrors";

/**
 * L'état de la migration DANS ce processus, et ce que le public en voit.
 *
 * Public (`/api/health` → `database`, réponses 503 du mode maintenance, écran
 * d'attente des clients) : le moteur, l'état, une progression en NOMBRES, et le
 * motif d'un échec (un mot de la liste fermée `MigrationFailureReason`). Jamais
 * un chemin, un nom de table, un texte d'erreur ni une empreinte (audit S5) : le
 * détail va au journal `[db-migration]` et à la carte de l'admin.
 */
export type DatabaseState = "ready" | "migrating" | "failed";

export interface PublicProgress {
  /** Tables copiées / à copier avant la bascule. */
  done: number;
  total: number;
  /** 0 à 100, au prorata du volume (une petite table ne pèse pas comme le cache). */
  percent: number;
  /** Temps restant estimé, en secondes ; `null` tant que l'estimation n'a pas de sens. */
  etaSeconds: number | null;
}

export interface PublicDatabaseState {
  engine: "sqlite";
  state: DatabaseState;
  progress?: PublicProgress;
  /** Échec seulement : de quoi choisir la phrase de l'écran (ex. passer d'abord par la 1.24). */
  reason?: MigrationFailureReason;
  /** Échec seulement : le prochain essai automatique, en secondes — absent quand il n'y en a pas (`source_missing`). */
  retryInSeconds?: number;
}

interface InternalState {
  state: DatabaseState;
  startedAt: number;
  tablesDone: number;
  tablesTotal: number;
  bytesDone: number;
  bytesTotal: number;
  reason?: MigrationFailureReason;
  /** `null` : pas de nouvel essai automatique (seul un redémarrage de la pile corrigée change la donne). */
  retryAt?: number | null;
}

let current: InternalState = { state: "ready", startedAt: 0, tablesDone: 0, tablesTotal: 0, bytesDone: 0, bytesTotal: 0 };

/** Une estimation ne se donne qu'après 3 % et 2 s : avant, elle mentirait. */
export function estimateEta(elapsedMs: number, fraction: number): number | null {
  if (fraction < 0.03 || elapsedMs < 2000 || fraction >= 1) return fraction >= 1 ? 0 : null;
  return Math.max(1, Math.round((elapsedMs * (1 - fraction)) / fraction / 1000));
}

export function migrationStarted(now = Date.now()): void {
  current = { state: "migrating", startedAt: now, tablesDone: 0, tablesTotal: 0, bytesDone: 0, bytesTotal: 0 };
}

export function migrationProgressed(p: { tablesDone: number; tablesTotal: number; bytesDone: number; bytesTotal: number }): void {
  current = { ...current, ...p };
}

export function migrationFailed(reason: MigrationFailureReason, retryAt: number | null): void {
  current = { ...current, state: "failed", reason, retryAt };
}

export function migrationFinished(): void {
  current = { state: "ready", startedAt: 0, tablesDone: 0, tablesTotal: 0, bytesDone: 0, bytesTotal: 0 };
}

export function isMigrating(): boolean {
  return current.state !== "ready";
}

export function publicDatabaseState(now = Date.now()): PublicDatabaseState {
  if (current.state === "ready") return { engine: "sqlite", state: "ready" };
  const fraction = current.bytesTotal > 0 ? Math.min(1, current.bytesDone / current.bytesTotal) : 0;
  const progress: PublicProgress = {
    done: current.tablesDone,
    total: current.tablesTotal,
    percent: Math.floor(fraction * 100),
    etaSeconds: current.state === "migrating" ? estimateEta(now - current.startedAt, fraction) : null,
  };
  if (current.state === "migrating") return { engine: "sqlite", state: "migrating", progress };
  return {
    engine: "sqlite",
    state: "failed",
    progress,
    reason: current.reason ?? "unknown",
    ...(current.retryAt === null || current.retryAt === undefined
      ? {}
      : { retryInSeconds: Math.max(0, Math.round((current.retryAt - now) / 1000)) }),
  };
}

/** Le corps des 503 du mode maintenance : `state` dit « migrating » même après un échec (la migration reste en cours). */
export function maintenanceBody(now = Date.now()) {
  const db = publicDatabaseState(now);
  return { state: "migrating" as const, database: db, progress: db.progress ?? null };
}
