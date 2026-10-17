import { useEffect, useState } from "react";
import { useInPreviewZone } from "../rows/BelowZonePage";
import type { CardModel } from "./cardTypes";
import { useCardPreview, type CardPreview } from "./trailerPreviewPort";

/**
 * Le FOCUS d'une carte qui demande l'aperçu de sa bande-annonce
 * (`MediaCard` `previewable`) : la carte dit seulement QUAND (son focus) et
 * DE QUOI (`card.trailer`) au port de l'aperçu (`trailerPreviewPort`) ; la
 * vidéo se joue dans la zone fixe en haut de l'écran, jamais dans la carte —
 * la carte ne grandit pas, la rangée ne bouge pas.
 *
 * Hors d'une page à zone (la recherche, une fiche : `useInPreviewZone`),
 * rien ne se demande — rien ne le jouerait.
 *
 * `watchFocus` (une affiche de grille) : un focus que la page a dépassé (le
 * défilement accéléré de tvOS) ne demande rien — la carte n'est déjà plus là
 * où l'on regarde.
 */

/** Suit la page depuis le focus de la carte : `onOutrun(true)` quand elle l'a dépassé (le
 *  défilement accéléré d'une grille) — son aperçu ne se demande pas. Rend l'arrêt. */
export type CardFocusWatch = (onOutrun: (outrun: boolean) => void) => () => void;

export function useCardPreviewFocus(card: CardModel, focused: boolean, watchFocus?: CardFocusWatch): CardPreview | null {
  const [outrun, setOutrun] = useState(false);
  useEffect(() => {
    if (!focused || !watchFocus) return undefined;
    const stop = watchFocus(setOutrun);
    return () => {
      stop();
      setOutrun(false);
    };
  }, [focused, watchFocus]);
  const inZone = useInPreviewZone();
  return useCardPreview(inZone ? card.trailer ?? null : null, inZone && focused && !outrun);
}
