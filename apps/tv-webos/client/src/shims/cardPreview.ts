import { useRef } from "react";
import type { CardPreviewController, CardPreviewOptions } from "@/components/cards/preview/useCardPreview";

/**
 * La mini-carte d'aperçu de bande-annonce, éteinte.
 *
 * Un téléviseur ne survole pas : la sélection, c'est le focus, et le moteur
 * de l'aperçu y est déjà inerte (`shims/trailerPreview.ts`). Ce module
 * remplace la SEULE porte des cartes vers la mini-carte
 * (`components/cards/preview/index.ts`) : son dossier ne se compile pas, sa
 * feuille n'existe pas, et aucune carte ne s'efface jamais (`shown` faux).
 */
export type { CardPreviewController, CardPreviewOptions, CardPreviewSource } from "@/components/cards/preview/useCardPreview";

function nothing(): void {
  /* Pas d'aperçu sur un téléviseur. */
}

export function useCardPreview(_options: CardPreviewOptions): CardPreviewController {
  // Des réfs à la carte : React y pose son visuel sans que personne ne le lise.
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const portalRef = useRef<HTMLDivElement | null>(null);
  return {
    shown: false,
    anchorRef,
    session: { subject: null, hovered: false, shape: "poster", disabled: true, anchorRef, portalRef, setShown: nothing },
  };
}

export function CardPreview(): null {
  return null;
}
