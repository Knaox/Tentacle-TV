/**
 * Octave — ce qui s'ÉCOUTE sans réseau, règle PURE commune aux plateformes
 * (`offlinePlayback.test.ts`). Hors ligne, les pages rendent leur copie d'avant
 * (accueil, playlists, titres likés : la cache gardée de la coquille) ; seul un
 * titre dont la copie COMPLÈTE est sur l'appareil s'y lit — les autres restent
 * visibles, atténués, et ne partent jamais dans la file (le lecteur ne bute pas
 * sur un titre muet, il passe au suivant gardé).
 */

import type { MusicTrack } from "@tentacle-tv/shared/music";
import type { KeptMusicTrack } from "../core/musicLibrary";

/** Ce titre a-t-il sa copie complète sur l'appareil (sous sa clé, ou celle d'hier : `byKey` du magasin) ? */
export function keptComplete(trackKey: string, byKey: ReadonlyMap<string, KeptMusicTrack>): boolean {
  return byKey.get(trackKey)?.status === "complete";
}

/** En ligne, tout se lit ; hors ligne, la copie gardée seulement. */
export function playableNow(trackKey: string, offline: boolean, byKey: ReadonlyMap<string, KeptMusicTrack>): boolean {
  return !offline || keptComplete(trackKey, byKey);
}

/**
 * La file à lancer depuis `index` : hors ligne, les titres gardés seulement, et le départ sur le titre touché —
 * ou, s'il n'est pas gardé, le premier gardé qui le suit (puis le premier de la liste). `null` : rien à lire.
 */
export function playableQueue(
  tracks: readonly MusicTrack[],
  index: number,
  offline: boolean,
  byKey: ReadonlyMap<string, KeptMusicTrack>,
): { tracks: MusicTrack[]; index: number } | null {
  if (!offline) return tracks.length === 0 ? null : { tracks: [...tracks], index: Math.max(0, Math.min(index, tracks.length - 1)) };
  const kept: MusicTrack[] = [];
  let start = -1;
  tracks.forEach((track, i) => {
    if (!keptComplete(track.key, byKey)) return;
    if (start < 0 && i >= index) start = kept.length;
    kept.push(track);
  });
  if (kept.length === 0) return null;
  return { tracks: kept, index: start < 0 ? 0 : start };
}
