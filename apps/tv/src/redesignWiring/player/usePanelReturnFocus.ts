import { useEffect, useRef } from "react";
import type { FocusStore } from "../focus/focusStore";

/** Le bouton de l'habillage qui ouvre chaque panneau. */
const OPENERS = { settings: "player:tracks", episodes: "player:episodes" } as const;

/** Les images à attendre : sous un panneau, l'habillage est à opacité nulle,
 *  et tvOS ne focalise rien d'invisible ; son fondu d'entrée doit avoir commencé. */
const FRAMES = 2;

/**
 * Un panneau du lecteur qui se ferme rend le focus à son bouton TOUT DE
 * SUITE, comme une fenêtre qu'on referme (Apple TV).
 *
 * La restauration partagée (`overlayFocusCore`) attend 220 ms, puis fait
 * cycler `hasTVPreferredFocus` : mesuré au simulateur, 330 ms sans focus
 * visible après la fermeture — parfois un détour par « Reculer de 10 s ».
 * Ici, deux images après la fermeture, quand le fondu de l'habillage a
 * commencé, `requestTVFocus` pose le focus sur le bouton qui avait ouvert le
 * panneau. La restauration différée reste le filet ; elle vise le même bouton.
 */
export function usePanelReturnFocus(store: FocusStore, showSettings: boolean, showEpisodes: boolean): void {
  const previous = useRef({ showSettings, showEpisodes });
  useEffect(() => {
    const was = previous.current;
    previous.current = { showSettings, showEpisodes };
    const key = was.showSettings && !showSettings
      ? OPENERS.settings
      : was.showEpisodes && !showEpisodes ? OPENERS.episodes : null;
    if (!key) return undefined;
    let frame = 0;
    let id = requestAnimationFrame(function step() {
      frame += 1;
      if (frame < FRAMES) {
        id = requestAnimationFrame(step);
        return;
      }
      store.focusNow(key);
    });
    return () => cancelAnimationFrame(id);
  }, [store, showSettings, showEpisodes]);
}
