import { useEffect, useRef } from "react";
import type { TransportKey } from "../components/player/focus/overlayFocusCore";

/**
 * Les deux moments où l'habillage du lecteur REPREND le focus de lui-même —
 * sortis de `PlayerScreen` tels quels, pour son budget de lignes ; les deux
 * habillages (Android TV, refonte Apple TV) les partagent.
 *
 * 1. L'habillage RÉAPPARAÎT : le focus va au dernier bouton de transport
 *    utilisé.
 * 2. L'ENTRÉE dans la vidéo : le focus va à lecture/pause. Personne ne le
 *    réclamait — le premier effet ne se déclenche qu'à une réapparition, et
 *    l'habillage est déjà visible au premier rendu. Le guide de l'habillage
 *    prenait donc son premier enfant focusable, qui est « quitter la vidéo » :
 *    un appui sur OK au lancement sortait du lecteur. À la première image, pas
 *    au montage : avant elle, l'écran de chargement occupe la dalle et tait
 *    l'habillage, dont les boutons ne sont pas focusables.
 */
export function useTVOsdEntryFocus(args: {
  overlayVisible: boolean;
  hasStarted: boolean;
  bumpOsdFocus: (target?: TransportKey) => void;
}) {
  const { overlayVisible, hasStarted, bumpOsdFocus } = args;

  const prevOverlayVisibleRef = useRef(true);
  useEffect(() => {
    if (overlayVisible && !prevOverlayVisibleRef.current) bumpOsdFocus();
    prevOverlayVisibleRef.current = overlayVisible;
  }, [overlayVisible, bumpOsdFocus]);

  const entryClaimedRef = useRef(false);
  useEffect(() => {
    if (!hasStarted || entryClaimedRef.current) return;
    entryClaimedRef.current = true;
    bumpOsdFocus("playpause");
  }, [hasStarted, bumpOsdFocus]);
}
