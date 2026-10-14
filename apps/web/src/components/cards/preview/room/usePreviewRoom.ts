import { useLayoutEffect, type RefObject } from "react";
import { previewQuiet } from "../previewQuiet";
import type { PreviewPlacement } from "../previewPlacement";
import { openPreviewRoom } from "./previewRoom";

interface PreviewRoomInput {
  /** La mini-carte est VUE — jamais pendant son préchargement caché. */
  shown: boolean;
  /** Sa place, en coordonnées du DOCUMENT (cf. `usePreviewSession`). */
  placement: PreviewPlacement | null;
  /** Le visuel de la carte : la pièce est le conteneur qui le porte. */
  anchorRef: RefObject<HTMLElement | null>;
  /** Animations réduites : rien ne glisse, la mini-carte apparaît par-dessus. */
  reduced: boolean;
}

/**
 * Les voisines s'écartent quand la mini-carte est VUE, et reviennent quand
 * elle part — dans la même image que sa propre entrée et sa propre sortie
 * (effet de mise en page, comme `setShown`).
 *
 * Le RETOUR fait glisser des cartes sous un pointeur peut-être immobile :
 * Chromium y fait survoler la carte qui arrive dessous par des évènements
 * synthétiques. Si le pointeur est dans la zone qui bouge, la porte globale se
 * ferme (`previewQuiet`) : aucune voisine ne lance son aperçu sans un vrai
 * mouvement — ni clignotement, ni ping-pong. Celle que le pointeur a VRAIMENT
 * rejointe, engagée avant, n'est pas interrompue.
 *
 * Animations réduites : aucun glissement. Un saut de six cartes serait pire
 * qu'un glissement, et la mini-carte, en fondu, se lit très bien par-dessus.
 */
export function usePreviewRoom({ shown, placement, anchorRef, reduced }: PreviewRoomInput): void {
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
      if (pointer && room.contains(pointer.x, pointer.y)) previewQuiet.quiet();
      room.close();
    };
  }, [shown, reduced, placement, anchorRef]);
}
