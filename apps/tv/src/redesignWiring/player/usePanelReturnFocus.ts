import { useCallback, useRef } from "react";
import type { FocusStore } from "../focus/focusStore";

/** Le bouton de l'habillage qui ouvre le panneau des épisodes ; la feuille,
 *  elle, a deux pilules (« Pistes », « Réglages ») et dit laquelle l'a ouverte. */
const EPISODES_OPENER = "player:episodes";

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
 * entre-temps (un second Retour), rien : le fond reprend le focus.
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
  if (showSettings) opener.current = sheetOpener;
  else if (showEpisodes) opener.current = EPISODES_OPENER;
  const visible = useRef(overlayVisible);
  visible.current = overlayVisible;

  return useCallback(() => {
    const key = opener.current;
    opener.current = null;
    if (key && visible.current) store.focusNow(key);
  }, [store]);
}
