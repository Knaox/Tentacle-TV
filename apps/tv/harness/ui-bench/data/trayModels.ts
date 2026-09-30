import {
  cardTrayEntries,
  externalCardActionEntries,
  i18n,
  resolveCardOverlay,
  resolveExternalCardOverlay,
  type CardOverlayVariant,
  type CardToggleStates,
  type ExternalCardVariant,
  type MediaItem,
} from "@tentacle-tv/shared";
import type { CardModel, CardTrayAction, CardTrayModel } from "../../../src/redesign/cards/cardTypes";
import type { BenchData } from "./benchData";
import { playOf, statesOf } from "./sheetModels";

/**
 * Les plateaux du banc, résolus comme le câblage le fera pour la carte qui a
 * le focus : le modèle partagé décide des boutons et de leur ordre
 * (`resolveCardOverlay` → `cardTrayEntries` ; hors bibliothèque,
 * `resolveExternalCardOverlay` → `externalCardActionEntries`), les libellés
 * passent par l'espace `cards`, le complément de la lecture par
 * `useCardSheetPlay` (`playOf`). Au banc, chaque carte a le sien : rien n'y
 * tourne, et le focus figé peut viser n'importe laquelle.
 */

const t = (key: string, options?: Record<string, unknown>) => i18n.t(key, options) as string;

/** Les mots de l'extension (Vigie), pas une clé du cœur : elle les traduit elle-même. */
export const requestLabel = () => (i18n.language.startsWith("fr") ? "Demander" : "Request");

export interface LibraryTrayOptions {
  /** Des états posés pour l'exemple (le compte de test n'en a presque pas). */
  force?: Partial<CardToggleStates>;
  /** Une note d'exemple, sur 10 (le compte de test n'en a posé aucune). */
  rating?: number | null;
  /** La cible de la note se résout encore (la série d'un épisode). */
  pendingRating?: boolean;
}

/** Le plateau d'un titre de la bibliothèque. */
export function libraryTray(
  data: BenchData,
  item: MediaItem,
  variant: CardOverlayVariant,
  options: LibraryTrayOptions = {},
): CardTrayModel {
  const play = playOf(data, item);
  const overlay = resolveCardOverlay({
    variant,
    inLibrary: true,
    playable: play !== null,
    resume: play?.resume,
    rateable: true,
    // Rien ne se garde hors ligne sur un téléviseur.
    offline: false,
  });
  const actions: CardTrayAction[] = [];
  for (const entry of cardTrayEntries(overlay, statesOf(item, options.force))) {
    if (entry.kind === "offline") continue;
    actions.push({
      kind: entry.kind,
      label: t(`cards:${entry.labelKey}`),
      active: entry.active,
      detail: entry.kind === "play" ? play?.detail : null,
    });
  }
  const current = options.rating !== undefined ? options.rating : data.snapshot.ratings[item.Id] ?? null;
  return { actions, rating: overlay.rate ? { current, pending: options.pendingRating } : null };
}

export interface ExternalTrayOptions {
  /** « Ma liste à l'arrivée » et le cœur posés (exemple). */
  watchlist?: boolean;
  favorite?: boolean;
  /** « Demander » en route. */
  busy?: boolean;
  rating?: number | null;
}

/** Le plateau d'un titre ABSENT de la bibliothèque (Vigie) : « Demander » en tête. */
export function externalTray(variant: ExternalCardVariant, options: ExternalTrayOptions = {}): CardTrayModel {
  const overlay = resolveExternalCardOverlay({
    variant,
    request: { mode: "direct", label: requestLabel(), href: null },
    identified: true,
  });
  const actions: CardTrayAction[] = [];
  for (const entry of externalCardActionEntries(overlay, { watchlist: options.watchlist ?? false, favorite: options.favorite })) {
    if (entry.kind === "offline") continue;
    actions.push({
      kind: entry.kind,
      label: entry.label ?? t(`cards:${entry.labelKey}`),
      active: entry.active,
      busy: entry.kind === "request" ? options.busy : undefined,
    });
  }
  return { actions, rating: overlay.rate ? { current: options.rating ?? null } : null };
}

/** La carte, avec son plateau. */
export const withTray = (card: CardModel, tray: CardTrayModel): CardModel => ({ ...card, tray });
