import { cardExtraLabelKey, type CardOverlayVariant, type CardTrayExtra } from "./cardOverlay";
import type { TitleRequestOffer } from "../search/pluginTitles";

/**
 * Le SURVOL d'une carte HORS bibliothèque — un titre qu'une extension de
 * demandes (Vigie) sait obtenir. Le pendant de `cardOverlay.ts`, dans la
 * MÊME grammaire, pour que la carte d'un titre absent se lise comme toutes
 * les autres, quelle que soit la page (recherche, recommandations,
 * filmographie, saga) — et comme dans l'extension elle-même :
 *
 *   • en bas, les étoiles (la note vit sur le tmdb), puis le plateau ;
 *   • EN TÊTE du plateau, l'action primaire, seule en couleur : « Demander »
 *     (il n'y a rien à lire). Plus de gros bouton au centre de l'affiche ;
 *   • puis « Ma liste à l'arrivée » — le signet des autres cartes, qui met le
 *     titre de côté jusqu'à son arrivée —, puis « Ne plus me proposer » sur
 *     une recommandation.
 *
 * Seule l'ENTRÉE change d'une plateforme à l'autre : le calque monté au
 * survol (web, bureau), la feuille de l'appui long (mobile, miroir). Aucune
 * télévision ne montre de titre hors bibliothèque.
 *
 * Ce module ne décide que de CE QUI est offert, dans quel ordre, et sous quel
 * libellé. Ce que « demander » veut dire appartient à l'extension (son offre
 * arrive toute faite, mots compris, cf. `pluginTitles.ts`).
 */

/** Une carte hors bibliothèque est une affiche : d'une recherche, ou d'une recommandation. */
export type ExternalCardVariant = Extract<CardOverlayVariant, "poster" | "reco">;

export interface ExternalCardOverlayInput {
  variant: ExternalCardVariant;
  /** Le geste qu'offre l'extension — `null` : rien à demander (déjà fait, déjà là, pas d'extension). */
  request: TitleRequestOffer | null;
  /** Le titre a une identité TMDB. Faux : ni note, ni Ma liste à l'arrivée. */
  identified: boolean;
}

export interface ExternalCardOverlay {
  variant: ExternalCardVariant;
  /** L'action primaire, en tête du plateau. */
  request: TitleRequestOffer | null;
  /** Le clic sur la carte ouvre toujours la page du titre. */
  open: "details";
  rate: boolean;
  /** « Ma liste à l'arrivée » — la seule bascule d'un titre absent. */
  watchlist: boolean;
  /** Ce qui suit, au bout du plateau. */
  extras: readonly CardTrayExtra[];
}

const NO_EXTRAS: readonly CardTrayExtra[] = [];
const DISMISS: readonly CardTrayExtra[] = ["dismiss"];

export function resolveExternalCardOverlay(input: ExternalCardOverlayInput): ExternalCardOverlay {
  return {
    variant: input.variant,
    request: input.request,
    open: "details",
    rate: input.identified,
    watchlist: input.identified,
    extras: input.variant === "reco" ? DISMISS : NO_EXTRAS,
  };
}

/**
 * Clé (espace `cards`) du libellé de « Ma liste à l'arrivée » : il dit ce que
 * fera le geste, donc il dépend de l'état.
 */
export function externalWatchlistLabelKey(active: boolean): string {
  return active ? "removeFromWatchlistOnArrival" : "addToWatchlistOnArrival";
}

/** Une action de carte hors bibliothèque, telle que le plateau ou une feuille la présente. */
export interface ExternalCardActionEntry {
  kind: "request" | "watchlist" | CardTrayExtra;
  /** Les mots de l'extension (« Demander ») — l'action `request` seulement. */
  label?: string;
  /** Clé du libellé, espace `cards` — les autres actions. */
  labelKey?: string;
  /** L'état courant — la bascule seulement. */
  active?: boolean;
}

/**
 * Les actions, à plat, dans l'ordre UNIQUE du plateau du survol comme de la
 * feuille de l'appui long : l'action primaire d'abord, puis la bascule, puis
 * les extras. La note n'y figure pas : elle se rend en étoiles, à part
 * (`overlay.rate`).
 */
export function externalCardActionEntries(
  overlay: ExternalCardOverlay,
  state: { watchlist: boolean },
): ExternalCardActionEntry[] {
  const entries: ExternalCardActionEntry[] = [];
  if (overlay.request) entries.push({ kind: "request", label: overlay.request.label });
  if (overlay.watchlist) {
    entries.push({ kind: "watchlist", labelKey: externalWatchlistLabelKey(state.watchlist), active: state.watchlist });
  }
  for (const extra of overlay.extras) entries.push({ kind: extra, labelKey: cardExtraLabelKey(extra) });
  return entries;
}
