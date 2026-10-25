/**
 * Octave — l'état gardé d'un titre ou d'une collection, règle PURE
 * (`keptProgress.test.ts`) : ce que montrent le bouton de l'en-tête, la marque
 * d'une rangée et la vue « Sur cet appareil ».
 */

import type { KeptMusicTrack } from "@tentacle-tv/offline-core";

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

/** Un titre seul. */
export function trackPhase(kept: KeptMusicTrack | null | undefined): KeptPhase {
  if (!kept || kept.status === "canceled") return "none";
  if (kept.status === "complete") return "complete";
  if (kept.status === "error") return "failed";
  return "progress";
}

function trackFraction(kept: KeptMusicTrack): number {
  if (kept.status === "complete") return 1;
  if (kept.expectedSize !== null && kept.expectedSize > 0) return Math.min(1, kept.bytesDone / kept.expectedSize);
  return 0;
}

/**
 * Une collection (les clés de ses titres) : rien gardé → `none` ; un transfert
 * en cours → `progress` ; tout complet → `complete` ; plus rien en cours mais un
 * titre en défaut → `failed` (le geste propose de réessayer).
 */
export function collectionSummary(keys: readonly string[], byKey: ReadonlyMap<string, KeptMusicTrack>): KeptSummary {
  const kept = keys.map((k) => byKey.get(k)).filter((k): k is KeptMusicTrack => !!k && k.status !== "canceled");
  if (kept.length === 0) return NONE;
  const done = kept.filter((k) => k.status === "complete").length;
  const running = kept.some((k) => trackPhase(k) === "progress");
  const failed = kept.some((k) => k.status === "error");
  const fraction = kept.reduce((sum, k) => sum + trackFraction(k), 0) / kept.length;
  const phase: KeptPhase = running ? "progress" : failed ? "failed" : done === kept.length ? "complete" : "progress";
  return { phase, done, total: kept.length, fraction };
}

/** La place occupée par ce que le compte a gardé (octets complets ou reçus). */
export function keptBytes(tracks: readonly KeptMusicTrack[]): number {
  return tracks.reduce((sum, k) => sum + (k.status === "complete" ? (k.expectedSize ?? k.bytesDone) : k.bytesDone), 0);
}
