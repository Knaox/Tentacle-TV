/**
 * Octave — l'état gardé d'un titre ou d'une collection, règle PURE
 * (`keptProgress.test.ts`) : ce que montrent le bouton de l'en-tête, la marque
 * d'une rangée et la vue « Sur cet appareil ».
 */

import type { KeptMusicCollection, KeptMusicTrack } from "../core/musicLibrary";
import { isHeld } from "./syncPlan";

export type KeptPhase = "none" | "progress" | "complete" | "failed";

export interface KeptSummary {
  phase: KeptPhase;
  /** Titres gardés en entier, sur `total` titres demandés. */
  done: number;
  total: number;
  /** 0..1, d'après les octets quand on les connaît, sinon les titres. */
  fraction: number;
}

const NONE: KeptSummary = { phase: "none", done: 0, total: 0, fraction: 0 };

/**
 * Ce que la marque d'un titre en cours dit (28/10 : « en début de transfert », puis « gardé » d'un coup) :
 * `waiting` en file ; `preparing` le serveur le prépare, aucun octet encore (`KeptMusicTrack.preparing`) ;
 * `transferring` ses octets arrivent, la fraction avance.
 */
export type KeptStage = "none" | "waiting" | "preparing" | "transferring" | "complete" | "failed";

export function trackStage(kept: KeptMusicTrack | null | undefined): KeptStage {
  const phase = trackPhase(kept);
  if (phase !== "progress") return phase;
  const live = kept?.status === "downloading" || (kept?.status === "paused" && !kept.pausedByUser);
  if (kept?.preparing && live) return "preparing";
  return kept?.status === "downloading" ? "transferring" : "waiting";
}

/** Un titre seul. */
export function trackPhase(kept: KeptMusicTrack | null | undefined): KeptPhase {
  if (!kept || kept.status === "canceled") return "none";
  if (kept.status === "complete") return "complete";
  if (kept.status === "error") return "failed";
  return "progress";
}

export function trackFraction(kept: KeptMusicTrack): number {
  if (kept.status === "complete") return 1;
  if (kept.expectedSize !== null && kept.expectedSize > 0) return Math.min(1, kept.bytesDone / kept.expectedSize);
  return 0;
}

/**
 * Une collection (les clés de ses titres) : rien gardé → `none` ; un transfert
 * en cours → `progress` ; tout complet → `complete` ; plus rien en cours mais un
 * titre en défaut → `failed` (le geste propose de réessayer).
 *
 * `wholeKept` : la collection a été gardée EN ENTIER (elle figure parmi les
 * collections du compte). Sinon, ses titres gardés par ailleurs (l'album d'un
 * titre de la playlist) ne font pas d'elle une collection gardée : s'il lui en
 * manque, `none` — le geste propose de la garder (le moteur s'accroche à ce qui
 * est déjà là).
 */
export function collectionSummary(keys: readonly string[], byKey: ReadonlyMap<string, KeptMusicTrack>, wholeKept = true): KeptSummary {
  const kept = keys.map((k) => byKey.get(k)).filter((k): k is KeptMusicTrack => !!k && k.status !== "canceled");
  if (kept.length === 0 || (!wholeKept && kept.length < keys.length)) return NONE;
  const done = kept.filter((k) => k.status === "complete").length;
  const running = kept.some((k) => trackPhase(k) === "progress");
  const failed = kept.some((k) => k.status === "error");
  const fraction = kept.reduce((sum, k) => sum + trackFraction(k), 0) / kept.length;
  const phase: KeptPhase = running ? "progress" : failed ? "failed" : done === kept.length ? "complete" : "progress";
  return { phase, done, total: kept.length, fraction };
}

/**
 * Où en est un lot (une playlist entière) : combien de ses titres attendent, se préparent, arrivent. L'en-tête
 * peut le dire à côté de « 12 sur 189 ».
 */
export function collectionStages(keys: readonly string[], byKey: ReadonlyMap<string, KeptMusicTrack>): Record<"waiting" | "preparing" | "transferring", number> {
  const out = { waiting: 0, preparing: 0, transferring: 0 };
  for (const key of keys) {
    const stage = trackStage(byKey.get(key));
    if (stage === "waiting" || stage === "preparing" || stage === "transferring") out[stage] += 1;
  }
  return out;
}

/** La place occupée par ce que le compte a gardé (octets complets ou reçus). */
export function keptBytes(tracks: readonly KeptMusicTrack[]): number {
  // Les octets sur le disque : la taille d'un Allégé n'est qu'une estimation jusqu'au bout.
  return tracks.reduce((sum, k) => sum + k.bytesDone, 0);
}

/**
 * Ce que retirer la collection `wholeKey` emporte de l'appareil : les copies de ses titres que rien d'autre ne
 * retient (un autre album, une autre playlist, un geste) — sous la clé montrée comme sous celle de la copie (un
 * titre qui a changé d'identité depuis, `keptRenames.ts`) —, chacune une fois.
 */
export function ownCopies(keys: readonly string[], byKey: ReadonlyMap<string, KeptMusicTrack>, collections: readonly KeptMusicCollection[], wholeKey: string): KeptMusicTrack[] {
  const out = new Map<number, KeptMusicTrack>();
  for (const key of keys) {
    const copy = byKey.get(key);
    if (copy && !isHeld(key, collections, wholeKey) && !isHeld(copy.trackKey, collections, wholeKey)) out.set(copy.fileId, copy);
  }
  return [...out.values()];
}

/**
 * Des titres PARTENT en ce moment (en file, en cours, en pause du système qui repart seule) : la pastille de
 * l'entrée « Hors ligne » de la navigation. Ni une pause voulue, ni un défaut, ni ce qui est gardé : rien à attendre.
 */
export function keptTransfersRunning(tracks: readonly KeptMusicTrack[]): boolean {
  return tracks.some((k) => k.status === "queued" || k.status === "downloading" || (k.status === "paused" && !k.pausedByUser));
}
