/**
 * Octave — « La suite arrive : le serveur prépare les titres à son rythme », règle PURE et commune au bureau
 * et au mobile (`serverPacing.test.ts`). La file du hors ligne en masse d'une extension (Sillon, lot « sq » du
 * 28/10) prépare un titre à la fois et répond 503 + `Retry-After` entre-temps : rien ne transfère, des titres
 * attendent le SERVEUR — ce n'est pas une coupure, et la page ne le dit jamais comme telle.
 *
 * L'estimation : la plus lointaine des relances que le serveur a fixées (`KeptMusicTrack.retryAt`), « prêt dans
 * ~2 h ». Elle ne couvre que les titres déjà demandés (trois à la fois) ; sans relance future, aucune estimation.
 */

import type { KeptMusicTrack } from "../core/musicLibrary";
import { trackStage } from "./keptProgress";

export interface ServerPacing {
  /** Rien ne transfère, et des titres attendent que le serveur les prépare. */
  pacing: boolean;
  /** Dans combien de temps la suite connue sera prête ; `null` : inconnu. */
  readyInMs: number | null;
}

export function serverPacingOf(tracks: readonly KeptMusicTrack[] | null, nowMs: number): ServerPacing {
  if (!tracks) return { pacing: false, readyInMs: null };
  let preparing = false;
  let readyAt: number | null = null;
  for (const track of tracks) {
    const stage = trackStage(track);
    if (stage === "transferring") return { pacing: false, readyInMs: null };
    if (stage !== "preparing") continue;
    preparing = true;
    const at = track.retryAt ?? null;
    if (at !== null && at > nowMs && (readyAt === null || at > readyAt)) readyAt = at;
  }
  return { pacing: preparing, readyInMs: preparing && readyAt !== null ? readyAt - nowMs : null };
}

/** « prêt dans ~40 min », « prêt dans ~2 h » : la clé de `musicOffline.transfers` et son nombre, arrondis à ce qu'on peut promettre. */
export function readyInWords(readyInMs: number): { key: "transfers.readyInMinutes" | "transfers.readyInHours"; count: number } {
  const minutes = Math.max(1, Math.round(readyInMs / 60_000));
  if (minutes < 60) return { key: "transfers.readyInMinutes", count: minutes };
  return { key: "transfers.readyInHours", count: Math.round(minutes / 60) };
}
