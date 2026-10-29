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

/**
 * Une COUPURE réseau (flux coupé, serveur muet, 5xx) n'est pas une erreur :
 * c'est une pause système. Jusqu'ici, seul un évènement la relançait — retour
 * au premier plan, changement de réseau, redémarrage. Application derrière ou
 * écran verrouillé, rien de tout cela n'arrive : un transfert coupé une fois
 * ne repartait JAMAIS en arrière-plan (alpha mobile, 21/10). Il se relance
 * donc seul, sans limite de tentatives, à des intervalles qui s'allongent puis
 * plafonnent à cinq minutes.
 */
export const NETWORK_RETRY_DELAYS_MS: readonly number[] = [5_000, 15_000, 30_000, 60_000, 120_000, 300_000];

/**
 * Le délai de la tentative `attempt` (0 = la première) : la dernière marche de
 * l'échelle se répète. Échelle vide : aucune relance (`null`).
 *
 * `immediate` : les premières tentatives repartent SANS délai. C'est le cas de
 * l'iPhone derrière : un minuteur n'y sonnerait jamais (JavaScript suspendu),
 * alors que la tâche remise tout de suite à la session d'arrière-plan attend
 * elle-même le retour du réseau, sans nous.
 */
export function networkRetryDelay(
  attempt: number,
  delays: readonly number[] = NETWORK_RETRY_DELAYS_MS,
  immediate = 0,
): number | null {
  if (delays.length === 0) return null;
  if (Math.max(0, attempt) < immediate) return 0;
  const index = Math.min(Math.max(0, Math.trunc(attempt)), delays.length - 1);
  return delays[index] ?? null;
}

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

/**
 * Date la relance d'une pause système née d'une coupure réseau. Ne consomme
 * aucune des trois tentatives des vraies erreurs (`retry_count`) : une nuit de
 * Wi-Fi capricieux ne doit pas épuiser les relances d'un disque occupé.
 */
export function scheduleNetworkRetry(db: DatabaseHandle, fileId: number, dueAt: number | null, nowMs: number): void {
  db.prepare("UPDATE files SET next_retry_at = ?, last_error_at = ?, updated_at = ? WHERE id = ?").run(
    dueAt,
    nowMs,
    nowMs,
    fileId,
  );
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
  // Les pauses SYSTÈME datées sont des coupures réseau en attente de leur
  // relance (`scheduleNetworkRetry`) ; une pause de l'utilisateur n'a jamais
  // d'échéance, et la condition l'exclut quand même.
  const result = db
    .prepare(
      `UPDATE files SET status = 'queued', error_code = NULL, next_retry_at = NULL,
              paused_by_user = 0, updated_at = ?
       WHERE (status = 'error' OR (status = 'paused' AND paused_by_user = 0))
         AND next_retry_at IS NOT NULL AND next_retry_at <= ?`,
    )
    .run(nowMs, nowMs);
  return Number(result.changes);
}

/** Prochaine échéance programmée, `null` s'il n'y en a aucune. */
export function nextRetryDueAt(db: DatabaseHandle): number | null {
  const row = db
    .prepare(
      `SELECT MIN(next_retry_at) AS due FROM files
       WHERE (status = 'error' OR (status = 'paused' AND paused_by_user = 0))
         AND next_retry_at IS NOT NULL`,
    )
    .get();
  return row === undefined ? null : integerOrNull(row, "due");
}

/**
 * Les fichiers qui attendent une relance programmée : rien en vol, rien de fini
 * non plus — une fermeture les interromprait comme ceux de la file.
 */
export function countAwaitingRetry(db: DatabaseHandle): number {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS n FROM files
       WHERE (status = 'error' OR (status = 'paused' AND paused_by_user = 0))
         AND next_retry_at IS NOT NULL`,
    )
    .get();
  return row === undefined ? 0 : integer(row, "n");
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
