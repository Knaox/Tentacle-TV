/**
 * L'activité EN DIRECT d'un lot de transferts hors ligne — ce que l'écran
 * verrouillé du téléphone en dit (Live Activity d'iOS, notification permanente
 * d'Android) : combien de titres, où en est l'ensemble, et SURTOUT pourquoi
 * ça n'avance pas quand ça n'avance pas.
 *
 * Règle pure, sans horloge ni plateforme : l'appelant donne les entrées du
 * lot, la progression vive (débit lissé par fichier, `progressStore`) et ce
 * que le réseau impose ; elle rend une PHASE et des nombres. Le temps restant
 * n'existe qu'en phase `transferring` : jamais un compte à rebours pendant
 * une attente (Wi-Fi, réseau, pause, relance).
 */

import type { DownloadStatus } from "../core/store";

/** Une entrée du lot, telle que la liste locale la donne (`DownloadListEntry` la satisfait). */
export interface LiveTransferEntry {
  id: number;
  itemId: string;
  status: DownloadStatus;
  pausedByUser: boolean;
  phase: string | null;
  errorCode: string | null;
  nextRetryAt: number | null;
  bytesDone: number;
  expectedSize: number | null;
  title: string | null;
  seriesName: string | null;
  kind: "movie" | "episode" | string | null;
}

/** La progression vive d'un fichier (`ProgressSnapshot` la satisfait). */
export interface LiveTransferProgress {
  bytesDone: number;
  expectedSize: number | null;
  rateBps: number | null;
}

/** Ce que le réseau impose au lot (`transferWait` du mobile). */
export type LiveNetworkWait = "wifi" | "network" | null;

export type LiveTransferPhase =
  /** Ça avance, et l'on sait dire dans combien de temps. */
  | "transferring"
  /** Ça avance (ou va partir) mais le débit ou les tailles manquent encore. */
  | "estimating"
  /** Tous les octets sont là ; reste la finalisation (remux) sur le téléphone. */
  | "finalizing"
  | "waitingWifi"
  | "waitingNetwork"
  /** Mis en pause par l'utilisateur. */
  | "paused"
  /** Un échec passager : relance automatique programmée. */
  | "retrying";

export interface LiveTransferView {
  phase: LiveTransferPhase;
  /** Titres qui restent à préparer (le lot moins ce qui est prêt). */
  remaining: number;
  /** Titres du lot, prêts compris. */
  total: number;
  /** Avancement de l'ensemble, 0 à 1 ; `null` tant qu'aucune taille n'est connue. */
  fraction: number | null;
  /** Temps restant BRUT (non lissé), ms — seulement en `transferring`. */
  rawEtaMs: number | null;
  /** Le titre, s'il ne reste qu'un titre. */
  single: { itemId: string; title: string | null; seriesName: string | null; kind: string | null } | null;
  /** La série commune à tout ce qui reste, si c'est le cas. */
  seriesName: string | null;
}

const PENDING: ReadonlySet<DownloadStatus> = new Set(["queued", "downloading", "paused"]);

/** Une entrée encore à préparer : en file, en cours, en pause, ou en échec avec relance prévue. */
export function isLivePending(entry: Pick<LiveTransferEntry, "status" | "nextRetryAt">): boolean {
  return PENDING.has(entry.status) || (entry.status === "error" && entry.nextRetryAt !== null);
}

/**
 * Les fichiers du lot : ceux d'avant qui y sont encore, plus tout ce qui
 * attend. Un lot sans plus rien en attente est terminé : il repart à vide.
 */
export function nextLiveBatch(previous: ReadonlySet<number>, entries: readonly LiveTransferEntry[]): Set<number> {
  const pending = entries.filter(isLivePending);
  if (pending.length === 0) return new Set();
  const present = new Set(entries.map((entry) => entry.id));
  const batch = new Set([...previous].filter((id) => present.has(id)));
  for (const entry of pending) batch.add(entry.id);
  return batch;
}

function bytesOf(entry: LiveTransferEntry, live: LiveTransferProgress | undefined): { done: number; size: number | null } {
  const size = live?.expectedSize ?? entry.expectedSize;
  if (entry.status === "complete") return { done: size ?? entry.bytesDone, size: size ?? entry.bytesDone };
  return { done: live?.bytesDone ?? entry.bytesDone, size };
}

function phaseOf(
  pending: readonly LiveTransferEntry[],
  wait: LiveNetworkWait,
  rateBps: number,
  remainingBytes: number | null,
): LiveTransferPhase {
  const running = pending.filter((entry) => entry.status === "downloading");
  if (running.length === 0) {
    if (wait === "wifi") return "waitingWifi";
    if (wait === "network") return "waitingNetwork";
    if (pending.every((entry) => entry.status === "paused" && entry.pausedByUser)) return "paused";
    if (pending.some((entry) => entry.status === "error")) return "retrying";
    return "estimating";
  }
  // Le remux vient après le dernier octet : rien à compter à rebours.
  if (running.every((entry) => entry.phase === "finalize") && remainingBytes === 0) return "finalizing";
  return remainingBytes !== null && remainingBytes > 0 && rateBps > 0 ? "transferring" : "estimating";
}

function commonSeries(entries: readonly LiveTransferEntry[]): string | null {
  const first = entries[0];
  if (first === undefined || first.kind !== "episode" || !first.seriesName) return null;
  return entries.every((entry) => entry.kind === "episode" && entry.seriesName === first.seriesName) ? first.seriesName : null;
}

/**
 * La vue du lot. `null` quand plus rien n'attend : l'activité s'efface.
 *
 * Temps restant = octets restants de TOUT ce qui attend ÷ débit cumulé de ce
 * qui tourne : les titres en file partiront au même débit. Une seule taille
 * inconnue et l'on n'avance pas de chiffre (`estimating`) : un compte à rebours
 * qui sauterait de dix minutes à l'arrivée de la taille serait un mensonge.
 */
export function liveTransferView(input: {
  entries: readonly LiveTransferEntry[];
  batch: ReadonlySet<number>;
  progress: (fileId: number) => LiveTransferProgress | undefined;
  wait: LiveNetworkWait;
}): LiveTransferView | null {
  const inBatch = input.entries.filter((entry) => input.batch.has(entry.id));
  const pending = inBatch.filter(isLivePending);
  if (pending.length === 0) return null;

  let doneBytes = 0;
  let sizeBytes = 0;
  let unknownSize = false;
  let remainingBytes = 0;
  let rateBps = 0;
  for (const entry of inBatch) {
    if (entry.status === "canceled" || (entry.status === "error" && entry.nextRetryAt === null)) continue;
    const live = input.progress(entry.id);
    const { done, size } = bytesOf(entry, live);
    if (size === null || size <= 0) {
      if (isLivePending(entry)) unknownSize = true;
      continue;
    }
    doneBytes += Math.min(done, size);
    sizeBytes += size;
    if (isLivePending(entry) && !(entry.status === "paused" && entry.pausedByUser)) {
      remainingBytes += Math.max(0, size - done);
    }
    if (entry.status === "downloading" && live?.rateBps) rateBps += live.rateBps;
  }

  const remaining = unknownSize ? null : remainingBytes;
  const phase = phaseOf(pending, input.wait, rateBps, remaining);
  const single = pending.length === 1 ? pending[0]! : null;
  return {
    phase,
    remaining: pending.length,
    total: inBatch.filter((entry) => entry.status !== "canceled").length,
    fraction: sizeBytes > 0 ? Math.min(1, doneBytes / sizeBytes) : null,
    rawEtaMs: phase === "transferring" && remaining !== null ? (remaining / rateBps) * 1_000 : null,
    single: single && { itemId: single.itemId, title: single.title, seriesName: single.seriesName, kind: single.kind },
    seriesName: commonSeries(pending),
  };
}
