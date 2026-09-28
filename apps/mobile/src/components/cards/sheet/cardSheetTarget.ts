import { recoMarkerItem, type RecoRowItem } from "@tentacle-tv/api-client";
import type { CardOverlayVariant, CardToggleHandlers, MediaItem } from "@tentacle-tv/shared";

/**
 * Ce qu'un appui long ouvre : la carte appuyée, telle que SON appelant la
 * connaît. La feuille ne devine rien — la variante et le libellé viennent de
 * la carte, comme le survol web les reçoit de la sienne (`CardHoverOverlay`).
 *
 *   • `poster`    — l'affiche 2:3 : son tap ouvre la fiche ;
 *   • `landscape` — la vignette 16:9 et la ligne d'épisode : son tap LANCE la
 *                   lecture, la fiche passe donc par « Plus d'infos » ;
 *   • `reco`      — la recommandation, en bibliothèque ou non.
 */
export interface CardSheetTarget {
  variant: CardOverlayVariant;
  /** Le visage Jellyfin de la carte — `null` : recommandation hors bibliothèque. */
  item: MediaItem | null;
  /** Le libellé de la carte : le titre de la feuille, lu par les lecteurs d'écran. */
  title: string;
  /** La recommandation d'origine (variante `reco`) : ses raisons, son refus, son tmdb. */
  reco?: RecoRowItem;
  /**
   * Titre lu sur le DISQUE (hors ligne, « Sur cet appareil ») : seule la coche
   * « vu » (`resolveCardOverlay({ local })`), ni note ni hors ligne, et rien
   * n'est demandé au serveur.
   */
  local?: boolean;
  /**
   * Des bascules fournies par l'appelant (l'état et le geste) plutôt que lues
   * sur le serveur — la coche « vu » d'un titre `local` vit en base locale.
   */
  toggles?: CardToggleHandlers;
}

/**
 * L'affiche 2:3. Un épisode y porte le visage de sa série (même règle que la
 * note, `cardRatingFor`) : c'est le nom de la série qui titre la feuille.
 */
export function posterSheetTarget(item: MediaItem): CardSheetTarget {
  const title = item.Type === "Episode" && item.SeriesName ? item.SeriesName : item.Name;
  return { variant: "poster", item, title };
}

/** La vignette 16:9 ou la ligne d'épisode : elle porte le nom du titre montré. */
export function landscapeSheetTarget(item: MediaItem): CardSheetTarget {
  return { variant: "landscape", item, title: item.Name };
}

/**
 * Une recommandation. En bibliothèque, son visage `MediaItem`
 * (`recoMarkerItem`) suffit à retrouver l'item — la feuille charge la fiche ;
 * hors bibliothèque, il n'y a pas d'item : ni lecture ni bascules, la note
 * (par tmdb) et le refus seulement.
 */
export function recoSheetTarget(reco: RecoRowItem): CardSheetTarget {
  return {
    variant: "reco",
    item: reco.jellyfinItemId ? recoMarkerItem(reco) : null,
    title: reco.title,
    reco,
  };
}
