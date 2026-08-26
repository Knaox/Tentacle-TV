/**
 * Redimensionnement du panneau de diagnostic, par la poignée du coin
 * INFÉRIEUR DROIT (le panneau est ancré haut-gauche : tirer vers le bas/la
 * droite agrandit). Borné, jamais plus grand que le viewport, persisté en
 * localStorage AU LÂCHER — modèle : `watchTogether/chat/useChatPanelSize.ts`.
 */

import { useCallback, useRef, useState } from "react";

export interface TaillePanneau {
  w: number;
  h: number;
}

const MIN_W = 360;
const MIN_H = 240;
const MAX_W = 960;
const MARGE_VIEWPORT = 24;

function clamp(t: TaillePanneau): TaillePanneau {
  return {
    w: Math.round(Math.min(Math.max(t.w, MIN_W), Math.min(MAX_W, window.innerWidth - MARGE_VIEWPORT))),
    h: Math.round(Math.min(Math.max(t.h, MIN_H), window.innerHeight - MARGE_VIEWPORT)),
  };
}

function charger(cle: string, defaut: TaillePanneau): TaillePanneau {
  try {
    const brut = localStorage.getItem(cle);
    if (brut) {
      const t = JSON.parse(brut) as Partial<TaillePanneau>;
      if (typeof t.w === "number" && typeof t.h === "number") return clamp({ w: t.w, h: t.h });
    }
  } catch {
    /* stockage indisponible/corrompu → taille par défaut */
  }
  return clamp(defaut);
}

export function usePanelResize(cle: string, defaut: TaillePanneau, onResizeEnd?: () => void) {
  const [taille, setTaille] = useState<TaillePanneau>(() => charger(cle, defaut));

  // Miroirs : lire la taille finale au pointerup sans re-créer l'écouteur.
  const tailleRef = useRef(taille);
  tailleRef.current = taille;
  const finRef = useRef(onResizeEnd);
  finRef.current = onResizeEnd;

  const demarrerResize = useCallback(
    (e: React.PointerEvent) => {
      // Ni le drag du panneau (le pointerdown remonterait jusqu'à lui), ni une
      // sélection de texte.
      e.preventDefault();
      e.stopPropagation();
      const poignee = e.currentTarget as HTMLElement;
      const departX = e.clientX;
      const departY = e.clientY;
      const depart = tailleRef.current;
      poignee.setPointerCapture(e.pointerId);

      const bouger = (ev: PointerEvent): void => {
        setTaille(clamp({ w: depart.w + (ev.clientX - departX), h: depart.h + (ev.clientY - departY) }));
      };
      const lacher = (): void => {
        poignee.removeEventListener("pointermove", bouger);
        poignee.removeEventListener("pointerup", lacher);
        poignee.removeEventListener("pointercancel", lacher);
        try {
          localStorage.setItem(cle, JSON.stringify(tailleRef.current));
        } catch {
          /* ignore */
        }
        // Agrandi vers le bas/la droite : ramener le panneau si ça déborde.
        finRef.current?.();
      };
      poignee.addEventListener("pointermove", bouger);
      poignee.addEventListener("pointerup", lacher);
      poignee.addEventListener("pointercancel", lacher);
    },
    [cle],
  );

  return { taille, demarrerResize };
}
