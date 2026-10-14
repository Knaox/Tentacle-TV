import { useLayoutEffect, type RefObject } from "react";
import { previewQuiet } from "../previewQuiet";
import type { PreviewPlacement } from "../previewPlacement";
import { claimPreviewRoom, openPreviewRoom } from "./previewRoom";

interface PreviewRoomInput {
  /** La mini-carte est VUE — jamais pendant son préchargement caché. */
  shown: boolean;
  /** Sa place, en coordonnées du DOCUMENT (cf. `usePreviewSession`). */
  placement: PreviewPlacement | null;
  /** Le visuel de la carte : la pièce est le conteneur qui le porte. */
  anchorRef: RefObject<HTMLElement | null>;
  /** Animations réduites : rien ne glisse, la mini-carte apparaît par-dessus. */
  reduced: boolean;
  /**
   * L'aperçu de CETTE carte est en route (survol engagé, mini-carte pas encore
   * vue) : elle réclame la pièce ouverte de la carte d'avant, qui l'attend.
   */
  claiming: boolean;
}

/**
 * Les voisines s'écartent quand la mini-carte est VUE, et reviennent quand
 * elle part — dans la même image que sa propre entrée et sa propre sortie
 * (effet de mise en page, comme `setShown`).
 *
 * Partie vers une VOISINE de la même pièce (pointeur dans la pièce, hors de sa
 * carte), la mini-carte laisse la pièce ATTENDRE : la voisine la réclame tant
 * que son aperçu est en route, et la pièce passe directement de l'écartement
 * de l'une à celui de l'autre — jamais un retour puis un nouvel écart
 * (`previewRoom.ts`). Le retour, quand il vient, tient la porte des aperçus
 * fermée le temps du glissement : la carte qu'il amène sous un pointeur
 * immobile ne lance rien.
 *
 * Animations réduites : aucun glissement. Un saut de six cartes serait pire
 * qu'un glissement, et la mini-carte, en fondu, se lit très bien par-dessus.
 */
export function usePreviewRoom({ shown, placement, anchorRef, reduced, claiming }: PreviewRoomInput): void {
  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (!shown || reduced || !placement || !anchor) return;
    // La page ne défile jamais à l'horizontale : la place du document est
    // celle de la fenêtre, à `scrollX` près.
    const left = placement.left - window.scrollX;
    const room = openPreviewRoom(anchor, { left, right: left + placement.width });
    if (!room) return;
    return () => {
      const pointer = previewQuiet.pointer();
      const toNeighbor = !!pointer && room.contains(pointer.x, pointer.y) && !room.onAnchor(pointer.x, pointer.y);
      if (toNeighbor) room.linger();
      else room.close();
    };
  }, [shown, reduced, placement, anchorRef]);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (!claiming || reduced || !anchor) return;
    const release = claimPreviewRoom(anchor);
    // Lâchée APRÈS la commande : si c'est l'ouverture de notre propre
    // mini-carte qui met fin à la réclamation, la pièce a déjà changé de main
    // et le lâcher ne la fait pas revenir.
    return release ? () => queueMicrotask(release) : undefined;
  }, [claiming, reduced, anchorRef]);
}
