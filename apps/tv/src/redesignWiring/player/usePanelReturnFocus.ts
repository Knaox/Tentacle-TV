import { useCallback, useRef } from "react";
import { panelOpener, panelReturnTarget } from "@tentacle-tv/tv-core";
import type { FocusStore } from "../focus/focusStore";

/**
 * Un panneau du lecteur qui se ferme rend le focus à son bouton À LA FIN DE
 * SA SORTIE (Apple TV) — le geste que la vue signale (`onPanelExited`).
 *
 * Le panneau GARDE son focus pendant son fondu : il s'efface d'un bloc, sa
 * ligne focalisée comme le reste, pendant que l'habillage revient. Rendu plus
 * tôt (deux images après la fermeture, avant), le focus quittait la ligne
 * pendant que le panneau était encore là : elle perdait son fond blanc et
 * passait par une barre grise vide, deux images — filmé. À la fin, le panneau
 * est invisible (`SWAP_FLOOR`) et l'habillage entier : `requestTVFocus` pose
 * le focus sur le bouton qui l'avait ouvert, avant que le panneau ne se
 * démonte — jamais un instant sans focus, jamais ailleurs.
 *
 * La restauration différée de l'habillage (`overlayFocusCore`, signal de la
 * fermeture) reste le filet : elle vise le même bouton. Habillage masqué
 * entre-temps (un second Retour), rien : le fond reprend le focus. Les
 * règles : tv-core (`panelOpener`, `panelReturnTarget`).
 */
export function usePanelReturnFocus(
  store: FocusStore,
  showSettings: boolean,
  showEpisodes: boolean,
  sheetOpener: string,
  overlayVisible: boolean,
): () => void {
  // Le bouton à qui rendre le focus : celui du dernier panneau ouvert.
  const opener = useRef<string | null>(null);
  opener.current = panelOpener({ showSettings, showEpisodes, sheetOpener, previous: opener.current });
  const visible = useRef(overlayVisible);
  visible.current = overlayVisible;

  return useCallback(() => {
    const key = panelReturnTarget(opener.current, visible.current);
    opener.current = null;
    if (key) store.focusNow(key);
  }, [store]);
}
