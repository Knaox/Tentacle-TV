/**
 * Octave (mobile) — le message « Le transfert sur données cellulaires est désactivé — L'activer », règle PURE
 * (`cellularWaitRule.test.ts`). Il se montre quand des titres gardés ATTENDENT (en file, ou en pause système :
 * jamais une pause demandée) et que la règle du Wi-Fi les retient (`wifiBlocked`, `transferGate.ts` : données
 * mobiles, réglage coupé, aucun « continuer » de session). Jamais une erreur : la file attend, et repart seule
 * au retour du Wi-Fi (`wifiOnlyAction`, `OfflineRuntimeSync`).
 */

import type { KeptMusicTrack } from "@tentacle-tv/offline-core";

/** Combien de titres attendent le Wi-Fi ; `0` : pas de message. */
export function cellularWaitCount(tracks: readonly Pick<KeptMusicTrack, "status" | "pausedByUser">[] | null, wifiBlocked: boolean): number {
  if (!wifiBlocked || !tracks) return 0;
  let count = 0;
  for (const track of tracks) {
    if (track.status === "queued" || (track.status === "paused" && !track.pausedByUser)) count += 1;
  }
  return count;
}
