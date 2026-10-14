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

import { trailerScopeKey, type TrailerEntry, type TrailerVersion } from "../../../trailers/trailerCatalog";
import { dailymotionRef, youtubeRef } from "../videoRef";

export interface PreviewCandidate {
  /** La clé du relais : l'identifiant YouTube nu, ou `dm:<id>` (`videoRef.ts`). */
  ref: string;
  /** Une vidéo YouTube : le garde-fou de YouTube (`youtubeGuard.ts`) la concerne. */
  youtube: boolean;
  /** 0 dans la langue du serveur, 1 sous-titrée, 2 autre (`TrailerVersion`). */
  langRank: number;
  /** La version, rendue au client (une VOSTFR garde ses sous-titres incrustés). */
  version: TrailerVersion;
  /** La portée (`s6`, `series`, `movie`) : de quoi passer à la suivante quand celle-ci ne se lit pas. */
  scope: string;
}

/** Trois essais au plus par portée, cinq en tout : une saison morte laisse sa chance aux autres. */
export const MAX_ATTEMPTS_PER_SCOPE = 3;
export const MAX_ATTEMPTS = 5;

/**
 * Les candidates à ESSAYER, dans l'ordre du catalogue : trois au plus par
 * portée, cinq en tout — si les vidéos de la saison de l'épisode ne se lisent
 * pas, les saisons d'avant, la série, puis les suivantes ont leur tour, comme
 * pour le bouton.
 */
export function attemptsOf(candidates: readonly PreviewCandidate[]): PreviewCandidate[] {
  const perScope = new Map<string, number>();
  const picked: PreviewCandidate[] = [];
  for (const candidate of candidates) {
    const count = perScope.get(candidate.scope) ?? 0;
    if (count >= MAX_ATTEMPTS_PER_SCOPE) continue;
    perScope.set(candidate.scope, count + 1);
    picked.push(candidate);
    if (picked.length >= MAX_ATTEMPTS) break;
  }
  return picked;
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
    candidates.push({
      ref, youtube: playback.kind === "youtube", langRank: LANG_RANK[entry.version], version: entry.version, scope: trailerScopeKey(entry.scope),
    });
  }
  return candidates;
}
