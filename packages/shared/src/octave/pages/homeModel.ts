/**
 * Octave — les règles PURES de l'accueil : la mosaïque d'un mix, le nom et le
 * sous-titre d'un mix, et ce que dit la reprise (le titre gardé, en pause).
 */

import type { MusicHomeMix, MusicTrack } from "../../music";

/** La file d'un mix : sa propre clé de contexte (le mix en cours se reconnaît sur sa carte). */
export const mixContextId = (mix: Pick<MusicHomeMix, "id">): string => `home:mix:${mix.id}`;

/** Quatre pochettes DISTINCTES pour une mosaïque ; moins de quatre → une seule, la première. */
export function mixMosaic(tracks: readonly MusicTrack[]): string[] {
  const urls: string[] = [];
  for (const track of tracks) {
    if (track.artworkUrl && !urls.includes(track.artworkUrl)) urls.push(track.artworkUrl);
    if (urls.length === 4) return urls;
  }
  return urls.slice(0, 1);
}

export type MixTitle = { key: "octaveHome.mixArtist"; artist: string } | { key: "octaveHome.mixFavorites" };

export function mixTitle(mix: Pick<MusicHomeMix, "kind" | "artist">): MixTitle {
  return mix.kind === "artist" && mix.artist ? { key: "octaveHome.mixArtist", artist: mix.artist.name } : { key: "octaveHome.mixFavorites" };
}

/** Le sous-titre : les artistes du mix (trois au plus), séparés comme une liste ordinaire. */
export function mixSubtitle(mix: Pick<MusicHomeMix, "artistNames">, locale: string): string {
  const names = mix.artistNames.slice(0, 3);
  try {
    return new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(names);
  } catch {
    return names.join(", ");
  }
}

/** La reprise s'offre pour un titre gardé, en pause — pendant l'écoute, la barre de lecture suffit. */
export function resumeOffer(current: MusicTrack | null, wantsPlay: boolean): MusicTrack | null {
  return current && !wantsPlay ? current : null;
}

/** Le temps laissé au lecteur pour reprendre le titre gardé, après l'arrivée sur l'accueil. */
export const RESUME_WINDOW_MS = 1500;

/**
 * La carte « Reprendre » ne fait pas bouger la page : elle n'APPARAÎT qu'à l'arrivée (le titre gardé, en
 * pause, repris dans la fenêtre du démarrage) et RESTE ensuite tant qu'il y a un titre — lecture, pause —,
 * jamais surgie au milieu de l'accueil parce qu'on a mis en pause.
 */
export function resumeShown(shown: boolean, inWindow: boolean, current: MusicTrack | null, wantsPlay: boolean): boolean {
  if (!current) return false;
  return shown || (inWindow && resumeOffer(current, wantsPlay) !== null);
}
