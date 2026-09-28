import { refOf } from "./anchors";
import type { AnchorSet } from "./anchorTypes";
import type { SignalItem } from "./signals";

/**
 * Les POTENTIELS d'un compte : les titres mis dans « Ma liste » sans avoir
 * encore été jugés — ni vus, ni suivis, ni notés, ni aimés, ni refusés. Une
 * intention n'est pas un goût : un potentiel ne pèse RIEN dans le profil (ni
 * ancre, ni graine, ni « Parce que vous avez aimé… ») ; il est seulement
 * connu comme tel — la page Statistiques le montre à part, et les
 * recommandations l'écartent déjà (on l'a choisi).
 *
 * Ma liste se lit à deux endroits : le drapeau Likes de Jellyfin (un titre de
 * la bibliothèque) et « Ma liste à l'arrivée » (watchlist_pending, drapeau
 * « watchlist » : un titre absent). Dès qu'un signal le juge, le titre quitte
 * les potentiels et devient — ou non — une ancre.
 */
export interface PotentialTitle {
  /** « movie:603 » ; « jf:<itemId> » sans identité TMDB. */
  key: string;
  mediaType: "movie" | "tv";
  /** 0 sans identité TMDB. */
  tmdbId: number;
  /** Vide pour un titre absent : le cache TMDB le donne au lecteur. */
  title: string;
  /** L'item Jellyfin ; null pour un titre pas encore arrivé. */
  jellyfinId: string | null;
}

/** Pure : l'appelant fournit les titres jugés, Ma liste et ses mises de côté. */
export function potentialsOf(
  set: Pick<AnchorSet, "judged">,
  watchlist: readonly SignalItem[],
  pending: ReadonlyArray<{ mediaType: string; tmdbId: number }> = []
): PotentialTitle[] {
  const out = new Map<string, PotentialTitle>();
  for (const item of watchlist) {
    const ref = refOf(item);
    if (!ref || set.judged.has(ref.key) || out.has(ref.key)) continue;
    out.set(ref.key, { ...ref, title: item.Name ?? "", jellyfinId: item.Id });
  }
  for (const p of pending) {
    const mediaType = p.mediaType === "movie" ? "movie" : "tv";
    const key = `${mediaType}:${p.tmdbId}`;
    if (set.judged.has(key) || out.has(key)) continue;
    out.set(key, { key, mediaType, tmdbId: p.tmdbId, title: "", jellyfinId: null });
  }
  return [...out.values()];
}
