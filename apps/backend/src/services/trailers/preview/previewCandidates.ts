/* ------------------------------------------------------------------ */
/*  Les bandes-annonces à essayer pour un aperçu, dans l'ordre          */
/*                                                                     */
/*  La règle de la fiche (`mergeTrailers`, recopiée de shared) : celles */
/*  de Jellyfin et de TMDB fusionnées par vidéo YouTube, la langue de  */
/*  l'interface d'abord (la VF en français), une vraie bande-annonce   */
/*  avant un teaser. L'aperçu n'en garde que les vidéos YouTube, et    */
/*  jamais ce qui n'est pas une bande-annonce : featurette, coulisses, */
/*  extrait, entretien — typés par TMDB, ou dits par leur libellé      */
/*  (`trailerKind` : un « Clip » qui se dit bande-annonce en est une). */
/* ------------------------------------------------------------------ */

import {
  mergeTrailers, parseYouTubeId, trailerKind, trailerLangRank, type JellyfinTrailer, type TmdbVideo,
} from "../../../trailers/trailerList";

export interface PreviewCandidate {
  ytId: string;
  /** 0 doublée dans la langue visée, 1 sous-titrée, 2 autre (`trailerLangRank`). */
  langRank: number;
}

/** Les vidéos YouTube à essayer, la meilleure d'abord, sans doublon, avec leur rang de langue. */
export function previewCandidates(jellyfin: readonly JellyfinTrailer[], tmdb: readonly TmdbVideo[], lang: string | undefined): PreviewCandidate[] {
  const seen = new Set<string>();
  const candidates: PreviewCandidate[] = [];
  for (const trailer of mergeTrailers([...jellyfin], [...tmdb], lang)) {
    const ytId = parseYouTubeId(trailer.Url);
    if (!ytId || seen.has(ytId)) continue;
    if (trailerKind(trailer) === "other") continue;
    seen.add(ytId);
    candidates.push({ ytId, langRank: trailerLangRank(trailer, lang) });
  }
  return candidates;
}
