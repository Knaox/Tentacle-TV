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

import { mergeTrailers, parseYouTubeId, trailerKind, type JellyfinTrailer, type TmdbVideo } from "../../../trailers/trailerList";

/** Les identifiants YouTube à essayer, le meilleur d'abord, sans doublon. */
export function previewCandidates(jellyfin: readonly JellyfinTrailer[], tmdb: readonly TmdbVideo[], lang: string | undefined): string[] {
  const seen = new Set<string>();
  const candidates: string[] = [];
  for (const trailer of mergeTrailers([...jellyfin], [...tmdb], lang)) {
    const ytId = parseYouTubeId(trailer.Url);
    if (!ytId || seen.has(ytId)) continue;
    if (trailerKind(trailer) === "other") continue;
    seen.add(ytId);
    candidates.push(ytId);
  }
  return candidates;
}
