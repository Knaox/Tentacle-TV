/**
 * La relance automatique après un échec.
 *
 * Jusqu'ici, une erreur attendait un geste : le fichier restait en `error`
 * jusqu'à ce que quelqu'un ouvre l'écran et appuie sur « Reprendre ». Trois
 * tentatives espacées suffisent à absorber ce qui se répare tout seul — un
 * disque momentanément occupé, un remux qui a manqué de place le temps d'un
 * export.
 *
 * Ce qui n'est PAS réessayé : un disque plein (le temps n'y change rien), un
 * média absent du serveur, et un contrôle d'intégrité raté — retélécharger
 * trente gigaoctets trois fois pour une source qui a changé coûterait quatre-
 * vingt-dix gigaoctets pour rien. Le bouton « Reprendre » reste là pour ces
 * cas-là.
 */

import type { DatabaseHandle } from "./adapters";
import { integer, integerOrNull } from "./rows";

/** Trois essais : la minute couvre une coupure passagère, au-delà c'est un vrai défaut. */
export const RETRY_DELAYS_MS: readonly number[] = [5_000, 15_000, 60_000];

/** Ce qui peut guérir tout seul. Voir l'en-tête pour ce qui en est exclu. */
export const RETRYABLE_CODES: ReadonlySet<string> = new Set(["io", "finalize", "unexpected"]);

/**
 * Compte l'échec et programme la relance suivante, s'il y en a une. Rend
 * `true` si une relance est effectivement programmée.
 *
 * `delays` vide (le banc d'essai, ou une plateforme qui n'en veut pas) : on
 * compte quand même, mais rien n'est programmé.
 */
export function recordFailure(
  db: DatabaseHandle,
  fileId: number,
  code: string,
  delays: readonly number[],
  nowMs: number,
): boolean {
  const row = db.prepare("SELECT retry_count FROM files WHERE id = ?").get(fileId);
  if (row === undefined) return false;
  const attempt = integer(row, "retry_count");
  const delay = RETRYABLE_CODES.has(code) ? delays[attempt] : undefined;
  db.prepare(
    `UPDATE files SET retry_count = retry_count + 1, last_error_at = ?,
            next_retry_at = ?, updated_at = ? WHERE id = ?`,
  ).run(nowMs, delay === undefined ? null : nowMs + delay, nowMs, fileId);
  return delay !== undefined;
}

/** Un geste de l'utilisateur, ou une réussite : le compteur repart de zéro. */
export function clearRetry(db: DatabaseHandle, fileId: number): void {
  db.prepare("UPDATE files SET retry_count = 0, next_retry_at = NULL WHERE id = ?").run(fileId);
}

/**
 * Remet en file ce dont l'échéance est atteinte. Rend le nombre de lignes
 * touchées — zéro veut dire « rien à faire », et l'appelant n'a alors rien à
 * notifier.
 *
 * `phase` n'est PAS effacée : c'est elle qui fera sauter le téléchargement
 * d'un fichier qui n'attend plus que son remux.
 */
export function requeueDueRetries(db: DatabaseHandle, nowMs: number): number {
  const result = db
    .prepare(
      `UPDATE files SET status = 'queued', error_code = NULL, next_retry_at = NULL,
              paused_by_user = 0, updated_at = ?
       WHERE status = 'error' AND next_retry_at IS NOT NULL AND next_retry_at <= ?`,
    )
    .run(nowMs, nowMs);
  return Number(result.changes);
}

/** Prochaine échéance programmée, `null` s'il n'y en a aucune. */
export function nextRetryDueAt(db: DatabaseHandle): number | null {
  const row = db
    .prepare(
      `SELECT MIN(next_retry_at) AS due FROM files
       WHERE status = 'error' AND next_retry_at IS NOT NULL`,
    )
    .get();
  return row === undefined ? null : integerOrNull(row, "due");
}

/**
 * Le minuteur des relances : un seul pour toute la file, toujours calé sur la
 * PROCHAINE échéance. Un minuteur par fichier en aurait armé autant que
 * d'erreurs, pour un seul réveil utile.
 */
export class RetryScheduler {
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly db: DatabaseHandle,
    private readonly now: () => number,
    private readonly onDue: () => void,
  ) {}

  /** Remet en file ce qui est échu ; `true` si quelque chose a bougé. */
  sweep(): boolean {
    return requeueDueRetries(this.db, this.now()) > 0;
  }

  arm(): void {
    this.clear();
    const due = nextRetryDueAt(this.db);
    if (due === null) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.onDue();
    }, Math.max(0, due - this.now()));
  }

  clear(): void {
    if (this.timer === null) return;
    clearTimeout(this.timer);
    this.timer = null;
  }
}
