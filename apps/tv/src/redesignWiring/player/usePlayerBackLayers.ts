import { useCallback, useEffect, useState } from "react";
import { isOsdPinned, playerBackLayers } from "@tentacle-tv/tv-core";
import { useBackLayers } from "../back/BackScope";
import type { PlayerRedesignStageProps } from "./playerStageTypes";

/**
 * L'habillage ÉPINGLÉ par la pause, tant que Retour ne l'a pas masqué (la
 * règle : tv-core `isOsdPinned`). En pause, l'habillage reste affiché ; Retour
 * le masque quand même — la surimpression d'abord, la sortie ensuite, comme en
 * lecture — et le moindre geste qui le rallume, comme une reprise ou une
 * nouvelle pause, l'épingle de nouveau.
 */
export function useOsdPin(paused: boolean, overlayVisible: boolean): { pinned: boolean; unpin: () => void } {
  const [unpinned, setUnpinned] = useState(false);
  useEffect(() => {
    if (overlayVisible) setUnpinned(false);
  }, [overlayVisible]);
  useEffect(() => setUnpinned(false), [paused]);
  const unpin = useCallback(() => setUnpinned(true), []);
  return { pinned: isOsdPinned(paused, unpinned), unpin };
}

/**
 * Les couches du Retour du lecteur (Apple TV), DÉCLARÉES par la règle de
 * tv-core (`playerBackLayers`) et inscrites dans la portée de l'écran
 * (`useBackLayers`) : un état passager, la feuille, les épisodes (menu) ;
 * l'habillage à l'écran (surimpression) ; la sortie (page). Aucun retrait
 * d'écran n'est retenu : Menu ne dépile plus le lecteur de lui-même.
 */
export function usePlayerBackLayers(p: PlayerRedesignStageProps, osd: { shown: boolean; unpin: () => void }): void {
  const { back } = p;
  const specs = playerBackLayers({
    transient: !!back?.transient, showSettings: p.showSettings, showEpisodes: !!p.showEpisodes, osdShown: osd.shown,
  });
  useBackLayers(specs, {
    routeTransient: () => void back?.routeBack(),
    closeSettings: p.onCloseSettings,
    closeEpisodes: () => p.onCloseEpisodes?.(),
    hideOverlay: () => {
      back?.hideOverlay();
      osd.unpin();
    },
    leave: p.onBack,
  });
}
