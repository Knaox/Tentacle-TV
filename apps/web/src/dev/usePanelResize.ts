/**
 * Redimensionnement du panneau de diagnostic, par la poignée du coin
 * INFÉRIEUR DROIT (le panneau est ancré haut-gauche : tirer vers le bas/la
 * droite agrandit). Borné, jamais plus grand que le viewport, persisté en
 * localStorage AU LÂCHER — modèle : `watchTogether/chat/useChatPanelSize.ts`.
 */

import { useCallback, useRef, useState } from "react";

export interface PanelSize {
  w: number;
  h: number;
}

const MIN_W = 360;
const MIN_H = 240;
const MAX_W = 960;
const VIEWPORT_MARGIN = 24;

function clamp(t: PanelSize): PanelSize {
  return {
    w: Math.round(Math.min(Math.max(t.w, MIN_W), Math.min(MAX_W, window.innerWidth - VIEWPORT_MARGIN))),
    h: Math.round(Math.min(Math.max(t.h, MIN_H), window.innerHeight - VIEWPORT_MARGIN)),
  };
}

function load(key: string, initial: PanelSize): PanelSize {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const t = JSON.parse(raw) as Partial<PanelSize>;
      if (typeof t.w === "number" && typeof t.h === "number") return clamp({ w: t.w, h: t.h });
    }
  } catch {
    /* stockage indisponible/corrompu → taille par défaut */
  }
  return clamp(initial);
}

export function usePanelResize(key: string, initial: PanelSize, onResizeEnd?: () => void) {
  const [size, setSize] = useState<PanelSize>(() => load(key, initial));

  // Miroirs : lire la taille finale au pointerup sans re-créer l'écouteur.
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const endRef = useRef(onResizeEnd);
  endRef.current = onResizeEnd;

  const startResize = useCallback(
    (e: React.PointerEvent) => {
      // Ni le drag du panneau (le pointerdown remonterait jusqu'à lui), ni une
      // sélection de texte.
      e.preventDefault();
      e.stopPropagation();
      const handle = e.currentTarget as HTMLElement;
      const startX = e.clientX;
      const startY = e.clientY;
      const start = sizeRef.current;
      handle.setPointerCapture(e.pointerId);

      const onMove = (ev: PointerEvent): void => {
        setSize(clamp({ w: start.w + (ev.clientX - startX), h: start.h + (ev.clientY - startY) }));
      };
      const onRelease = (): void => {
        handle.removeEventListener("pointermove", onMove);
        handle.removeEventListener("pointerup", onRelease);
        handle.removeEventListener("pointercancel", onRelease);
        try {
          localStorage.setItem(key, JSON.stringify(sizeRef.current));
        } catch {
          /* ignore */
        }
        // Agrandi vers le bas/la droite : ramener le panneau si ça déborde.
        endRef.current?.();
      };
      handle.addEventListener("pointermove", onMove);
      handle.addEventListener("pointerup", onRelease);
      handle.addEventListener("pointercancel", onRelease);
    },
    [key],
  );

  return { size, startResize };
}
