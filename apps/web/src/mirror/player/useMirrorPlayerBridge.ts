import { useMemo, useState } from "react";
import { useMirror } from "../useFormFactor";
import type { MirrorPlayerBridge } from "./types";

/**
 * L'aiguillage du lecteur web entre sa barre de bureau et la surcouche de
 * l'app mobile. Hors miroir (bureau, Electron compris), il rend TELLES QUELLES
 * la visibilité et l'état de glissé de `useControlsAutoHide` : rien ne change.
 *
 * Dans le miroir, l'habillage suit les règles de l'app (`PlayerScreen`) : il
 * tient sa visibilité (tap pour afficher/masquer, 4 s puis fondu), et le glissé
 * de la barre remonte à l'arbitre, qui suspend ses décomptes pendant ce temps.
 */
export function useMirrorPlayerBridge(desktopVisible: boolean, desktopScrubbing: boolean): {
  mirror: boolean;
  showControls: boolean;
  scrubbing: boolean;
  bridge: MirrorPlayerBridge;
} {
  const mirror = useMirror();
  const [visible, setVisible] = useState(true);
  const [scrubbing, setScrubbing] = useState(false);
  const bridge = useMemo(() => ({ visible, setVisible, setScrubbing }), [visible]);
  return {
    mirror,
    showControls: mirror ? visible : desktopVisible,
    scrubbing: mirror ? scrubbing : desktopScrubbing,
    bridge,
  };
}
