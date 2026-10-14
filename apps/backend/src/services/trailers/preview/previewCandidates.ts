/* ------------------------------------------------------------------ */
/*  Les bandes-annonces à essayer pour un aperçu, dans l'ordre          */
/*                                                                     */
/*  Celles du CATALOGUE du titre (`catalog/catalogBuild.ts`), dans son */
/*  ordre : la saison d'un épisode ou d'une saison d'abord, la langue  */
/*  du serveur d'abord (localisée, puis sous-titrée, puis le reste).   */
/*  L'aperçu n'en garde que les vidéos en ligne, que le relais lit :   */
/*  YouTube, et Dailymotion (AlloCiné) pour un client qui sait le lire */
/*  (`dm=1`) — une locale de Jellyfin n'a pas de flux relayé. Le bouton*/
/*  « Bande-annonce » et l'aperçu montrent ainsi la MÊME vidéo.        */
/* ------------------------------------------------------------------ */

import type { TrailerEntry, TrailerVersion } from "../../../trailers/trailerCatalog";
import { dailymotionRef, youtubeRef } from "../videoRef";

export interface PreviewCandidate {
  /** La clé du relais : l'identifiant YouTube nu, ou `dm:<id>` (`videoRef.ts`). */
  ref: string;
  /** Une vidéo YouTube : le garde-fou de YouTube (`youtubeGuard.ts`) la concerne. */
  youtube: boolean;
  /** 0 dans la langue du serveur, 1 sous-titrée, 2 autre (`TrailerVersion`). */
  langRank: number;
}

const LANG_RANK: Record<TrailerVersion, number> = { localized: 0, subtitled: 1, original: 2, unknown: 2 };

/** Les vidéos du catalogue que l'aperçu peut essayer, la meilleure d'abord, sans doublon. */
export function previewCandidates(entries: readonly TrailerEntry[], options: { dailymotion: boolean }): PreviewCandidate[] {
  const seen = new Set<string>();
  const candidates: PreviewCandidate[] = [];
  for (const entry of entries) {
    const { playback } = entry;
    const ref = playback.kind === "youtube"
      ? youtubeRef(playback.ytId).key
      : playback.kind === "dailymotion" && options.dailymotion ? dailymotionRef(playback.videoId).key : null;
    if (!ref || seen.has(ref)) continue;
    seen.add(ref);
    candidates.push({ ref, youtube: playback.kind === "youtube", langRank: LANG_RANK[entry.version] });
  }
  return candidates;
}
