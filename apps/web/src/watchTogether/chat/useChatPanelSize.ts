import { useCallback, useRef, useState } from "react";

/**
 * Watch Together — taille du panneau de chat desktop, redimensionnable par la
 * poignée du coin SUPÉRIEUR GAUCHE (le panneau est ancré bas-droite : tirer
 * vers la gauche/le haut agrandit). Bornée (min utilisable avec le sélecteur
 * ouvert, max raisonnable et jamais plus grand que le viewport) et persistée
 * en localStorage. Le bottom sheet mobile n'est pas concerné.
 */

export interface ChatPanelSize {
  w: number;
  h: number;
}

const STORAGE_KEY = "wt_chat_panel_size";
const MIN_W = 300;
const MAX_W = 560;
const MIN_H = 380;
const MAX_H = 760;

export const WT_CHAT_PANEL_DEFAULT: ChatPanelSize = { w: 320, h: 420 };

function clampSize(s: ChatPanelSize): ChatPanelSize {
  return {
    w: Math.round(Math.min(Math.max(s.w, MIN_W), Math.min(MAX_W, window.innerWidth - 40))),
    h: Math.round(Math.min(Math.max(s.h, MIN_H), Math.min(MAX_H, window.innerHeight - 120))),
  };
}

function loadSize(): ChatPanelSize {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ChatPanelSize>;
      if (typeof parsed.w === "number" && typeof parsed.h === "number") {
        return clampSize({ w: parsed.w, h: parsed.h });
      }
    }
  } catch { /* stockage indisponible/corrompu → taille par défaut */ }
  return WT_CHAT_PANEL_DEFAULT;
}

export function useChatPanelSize(onResizeEnd?: () => void) {
  const [size, setSize] = useState<ChatPanelSize>(loadSize);
  const [resizing, setResizing] = useState(false);

  // Miroir pour lire la taille finale au pointerup sans re-créer le listener.
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const onResizeEndRef = useRef(onResizeEnd);
  onResizeEndRef.current = onResizeEnd;

  const startResize = useCallback((e: React.PointerEvent) => {
    // Ne pas démarrer le drag du header ni une sélection de texte.
    e.preventDefault();
    e.stopPropagation();
    const handle = e.currentTarget as HTMLElement;
    const startX = e.clientX;
    const startY = e.clientY;
    const start = sizeRef.current;
    handle.setPointerCapture(e.pointerId);
    setResizing(true);

    const onMove = (ev: PointerEvent) => {
      setSize(clampSize({ w: start.w + (startX - ev.clientX), h: start.h + (startY - ev.clientY) }));
    };
    const onUp = () => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
      setResizing(false);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sizeRef.current));
      } catch { /* ignore */ }
      // Le panneau a grandi vers le haut/la gauche : le ramener dans le
      // viewport s'il déborde (même mécanique qu'après un drag).
      onResizeEndRef.current?.();
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  }, []);

  return { size, resizing, startResize };
}
