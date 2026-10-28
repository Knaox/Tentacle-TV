/**
 * Octave (mobile) — où en sont les titres qui partent sur l'appareil, règle PURE
 * (`transferModel.test.ts`) : la carte des transferts de « Sur cet appareil »,
 * l'entrée du hub et la file la lisent. Aucun réseau, aucune horloge propre.
 *
 * Le LOT : ce qui a été demandé depuis le plus ancien titre encore en cours, et
 * ce qui l'a été dans la foulée juste avant (titres d'une même demande, déjà
 * arrivés : moins de `LOT_GAP_MS` d'écart de proche en proche) — « 12 sur 30 »,
 * jamais « 512 sur 530 » parce qu'on a gardé une discothèque hier.
 * Les octets d'un titre dont la taille n'est pas encore connue (en file, en
 * préparation) sont ESTIMÉS d'après la taille moyenne des autres : le temps
 * restant le dit (« environ »).
 */

import type { KeptMusicTrack } from "@tentacle-tv/offline-core";
import { trackStage, type KeptStage } from "@tentacle-tv/offline-core/music";

export interface TransferProgressReading {
  /** Débit lissé du transfert (octets par seconde), `null` avant la mesure. */
  rateBps: number | null;
}

export interface KeptTransferSummary {
  /** Quelque chose est en cours, en pause ou en défaut : la carte se montre. */
  active: boolean;
  /** Titres du lot gardés en entier, sur `total`. */
  done: number;
  total: number;
  running: number;
  /** En pause par l'utilisateur (« Tout reprendre ») ; une pause système repart seule. */
  pausedByUser: number;
  failed: number;
  bytesDone: number;
  /** `null` : aucune taille connue dans le lot (la barre suit alors les titres). */
  bytesTotal: number | null;
  /** 0..1 : octets quand on les connaît, sinon titres. */
  fraction: number;
  /** Débit mesuré, tous transferts confondus ; `null` sans mesure. */
  rateBps: number | null;
  /** `null` : rien ne tourne, ou pas encore de mesure. */
  etaMs: number | null;
  /** Une taille au moins est estimée : le temps restant est approché. */
  estimated: boolean;
  /** La file, dans l'ordre où elle se lit : ce qui arrive, se prépare, attend, en pause, en défaut. */
  queue: KeptMusicTrack[];
}

/** Deux titres demandés à moins d'une minute l'un de l'autre font partie du même lot. */
export const LOT_GAP_MS = 60_000;

/** Le début du lot : le plus ancien titre en cours, puis en remontant tant que les demandes se suivent. */
function lotStart(live: readonly KeptMusicTrack[], oldestPending: number): number {
  const before = live.map((k) => k.createdAt).filter((at) => at < oldestPending).sort((a, b) => b - a);
  let start = oldestPending;
  for (const at of before) {
    if (start - at > LOT_GAP_MS) break;
    start = at;
  }
  return start;
}

const STAGE_ORDER: Partial<Record<KeptStage, number>> = { transferring: 0, preparing: 1, waiting: 2, failed: 4 };

const isPending = (k: KeptMusicTrack): boolean => k.status !== "complete" && k.status !== "canceled";

/** Un titre en pause VOULUE se range après l'attente, avant les défauts. */
function rank(k: KeptMusicTrack): number {
  if (k.status === "paused" && k.pausedByUser) return 3;
  return STAGE_ORDER[trackStage(k)] ?? 2;
}

export function transferSummary(
  tracks: readonly KeptMusicTrack[],
  progress: (fileId: number) => TransferProgressReading | undefined,
): KeptTransferSummary {
  const live = tracks.filter((k) => k.status !== "canceled");
  const pending = live.filter(isPending);
  if (pending.length === 0) {
    return { active: false, done: 0, total: 0, running: 0, pausedByUser: 0, failed: 0, bytesDone: 0, bytesTotal: null, fraction: 1, rateBps: null, etaMs: null, estimated: false, queue: [] };
  }
  const since = lotStart(live, Math.min(...pending.map((k) => k.createdAt)));
  const batch = live.filter((k) => k.createdAt >= since);
  const done = batch.filter((k) => k.status === "complete").length;

  // La taille de chaque titre : celle de la copie complète, l'attendue, sinon l'estimée.
  const known = batch.map((k) => (k.status === "complete" ? k.bytesDone : k.expectedSize !== null && k.expectedSize > 0 ? k.expectedSize : null));
  const sizes = known.filter((s): s is number => s !== null);
  const mean = sizes.length > 0 ? sizes.reduce((a, b) => a + b, 0) / sizes.length : null;
  const estimated = mean !== null && sizes.length < batch.length;
  const bytesTotal = mean === null ? null : known.reduce<number>((sum, s) => sum + (s ?? mean), 0);
  const bytesDone = batch.reduce((sum, k) => sum + k.bytesDone, 0);
  const fraction = bytesTotal !== null && bytesTotal > 0 ? Math.min(1, bytesDone / bytesTotal) : done / batch.length;

  const running = pending.filter((k) => k.status === "queued" || k.status === "downloading" || (k.status === "paused" && !k.pausedByUser)).length;
  const pausedByUser = pending.filter((k) => k.status === "paused" && k.pausedByUser).length;
  const failed = pending.filter((k) => k.status === "error").length;

  const rates = pending.filter((k) => k.status === "downloading").map((k) => progress(k.fileId)?.rateBps ?? null).filter((r): r is number => r !== null && r > 0);
  const rateBps = rates.length > 0 ? rates.reduce((a, b) => a + b, 0) : null;
  // Restent ce qui doit encore partir de lui-même : ni les défauts, ni les pauses voulues.
  const remaining = batch.reduce((sum, k, i) => {
    const moving = k.status === "queued" || k.status === "downloading" || (k.status === "paused" && !k.pausedByUser);
    return moving ? sum + Math.max(0, (known[i] ?? mean ?? 0) - k.bytesDone) : sum;
  }, 0);
  const etaMs = running > 0 && rateBps !== null && bytesTotal !== null ? (remaining / rateBps) * 1_000 : null;

  const queue = [...pending].sort((a, b) => rank(a) - rank(b) || a.createdAt - b.createdAt || a.fileId - b.fileId);
  return { active: true, done, total: batch.length, running, pausedByUser, failed, bytesDone, bytesTotal, fraction, rateBps, etaMs, estimated, queue };
}

/** Combien de temps le dernier débit mesuré tient quand un titre s'achève et que le suivant n'a pas encore de mesure. */
export const RATE_HOLD_MS = 8_000;

export interface HeldRate {
  rateBps: number | null;
  atMs: number;
}

/**
 * Le débit montré : la mesure du moment, sinon la dernière tant qu'elle a moins de `RATE_HOLD_MS` — sans quoi le
 * temps restant clignoterait à chaque passage d'un titre au suivant.
 */
export function holdRate(previous: HeldRate | null, measured: number | null, nowMs: number): HeldRate {
  if (measured !== null) return { rateBps: measured, atMs: nowMs };
  if (previous && previous.rateBps !== null && nowMs - previous.atMs < RATE_HOLD_MS) return previous;
  return { rateBps: null, atMs: nowMs };
}
