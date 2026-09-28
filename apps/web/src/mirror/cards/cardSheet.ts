import { createContext, useContext } from "react";
import type { RecoRowItem } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";

/**
 * Ce qu'ouvre l'appui long d'une carte de la bibliothèque : la carte
 * appuyée, sous la variante de son survol (`resolveCardOverlay`).
 */
export interface MediaSheetTarget {
  kind: "media";
  /** `poster` : le toucher de la carte ouvre la fiche ; `landscape` : il lance la lecture. */
  variant: "poster" | "landscape";
  /** L'item de la carte : rendu tout de suite, puis relu en entier (`useMediaItem`). */
  item: MediaItem;
}

/**
 * L'appui long d'une recommandation EN bibliothèque (variante `reco`). Hors
 * bibliothèque, c'est la feuille des cartes Vigie (`RecoActionSheet`).
 */
export interface RecoSheetTarget {
  kind: "reco";
  reco: RecoRowItem;
}

export type CardSheetTarget = MediaSheetTarget | RecoSheetTarget;

/** Le titre de la feuille, pour les lecteurs d'écran. */
export function cardSheetTitle(target: CardSheetTarget): string {
  return target.kind === "reco" ? target.reco.title : target.item.Name;
}

/** Une clé par carte : la feuille se remonte à neuf quand la cible change. */
export function cardSheetKey(target: CardSheetTarget): string {
  return target.kind === "reco" ? `reco:${target.reco.key}` : `${target.variant}:${target.item.Id}`;
}

/** Ouvre la feuille de l'écran (`CardSheetProvider`). */
export type OpenCardSheet = (target: CardSheetTarget) => void;

export const CardSheetContext = createContext<OpenCardSheet | null>(null);

/**
 * La feuille de l'écran courant — `null` hors d'un `CardSheetProvider` : la
 * carte n'a alors pas d'appui long, plutôt qu'un appui qui n'ouvre rien.
 */
export function useOpenCardSheet(): OpenCardSheet | null {
  return useContext(CardSheetContext);
}
