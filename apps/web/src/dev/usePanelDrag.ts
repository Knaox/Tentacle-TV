/**
 * Déplacement du panneau de diagnostic à la souris.
 *
 * Écrit à la main plutôt qu'avec une bibliothèque : c'est un outil de
 * développement, il ne doit rien peser dans les dépendances du produit.
 *
 * Les écouteurs vivent sur `window` et non sur le panneau : une souris qui
 * sort du panneau pendant le glisser doit continuer à le déplacer, sinon il
 * « décroche » dès qu'on va vite.
 *
 * Depuis que le bouton DEBUG se déplace aussi : `key` persiste la position en
 * localStorage (écrite AU LÂCHER seulement, re-clampée au chargement — modèle
 * `useChatPanelSize`), `grabButtons` court-circuite la garde anti-boutons
 * (indispensable pour glisser le bouton lui-même), et `hasDragged` dit si le
 * geste qui vient de finir était un déplacement — le clic qui le suit ne doit
 * pas ouvrir le panneau.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export interface Position {
  x: number;
  y: number;
}

export interface DragOptions {
  /** Clé localStorage ; absente = position non persistée. */
  key?: string;
  /** Laisser saisir un `<button>` — pour déplacer le bouton DEBUG lui-même. */
  grabButtons?: boolean;
}

const MARGIN = 8;
/** En deçà, un pointerdown+up est un CLIC, pas un déplacement. */
const DRAG_THRESHOLD_PX = 3;

/** Garde le panneau dans la fenêtre, même après un redimensionnement. */
function clampToWindow(p: Position, width: number, height: number): Position {
  return {
    x: Math.min(Math.max(p.x, MARGIN), Math.max(MARGIN, innerWidth - width - MARGIN)),
    y: Math.min(Math.max(p.y, MARGIN), Math.max(MARGIN, innerHeight - height - MARGIN)),
  };
}

function loadPosition(key: string | undefined, fallback: Position): Position {
  if (!key) return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Position>;
      if (typeof p.x === "number" && typeof p.y === "number") {
        // Taille inconnue avant le premier rendu : clamp au viewport seul ;
        // l'effet `resize` re-clampe avec la vraie taille dès qu'elle existe.
        return clampToWindow({ x: p.x, y: p.y }, 0, 0);
      }
    }
  } catch {
    /* stockage indisponible/corrompu → position par défaut */
  }
  return fallback;
}

export function usePanelDrag(initial: Position, options?: DragOptions) {
  const { key, grabButtons = false } = options ?? {};
  const [position, setPosition] = useState<Position>(() => loadPosition(key, initial));
  const element = useRef<HTMLElement | null>(null);
  const start = useRef<{ mouse: Position; panel: Position } | null>(null);
  /** Le geste en cours (ou le dernier) a-t-il dépassé le seuil de déplacement ? */
  const hasDragged = useRef(false);
  // Miroirs pour lire la dernière valeur au lâcher sans re-créer l'écouteur.
  const positionRef = useRef(position);
  positionRef.current = position;
  const keyRef = useRef(key);
  keyRef.current = key;

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Un clic sur un bouton du panneau ne doit pas le déplacer — sauf quand
      // c'est le bouton lui-même qu'on déplace.
      if (!grabButtons && (e.target as HTMLElement).closest("button")) return;
      hasDragged.current = false;
      start.current = { mouse: { x: e.clientX, y: e.clientY }, panel: position };
    },
    [position, grabButtons],
  );

  useEffect(() => {
    const onMove = (e: PointerEvent): void => {
      const d = start.current;
      if (!d) return;
      const dx = e.clientX - d.mouse.x;
      const dy = e.clientY - d.mouse.y;
      if (Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD_PX) hasDragged.current = true;
      const el = element.current;
      setPosition(clampToWindow({ x: d.panel.x + dx, y: d.panel.y + dy }, el?.offsetWidth ?? 0, el?.offsetHeight ?? 0));
    };
    const onRelease = (): void => {
      if (start.current === null) return;
      start.current = null;
      // Au lâcher seulement, jamais à chaque frame — et uniquement après un
      // vrai déplacement : un simple clic ne réécrit pas le stockage.
      if (keyRef.current && hasDragged.current) {
        try {
          localStorage.setItem(keyRef.current, JSON.stringify(positionRef.current));
        } catch {
          /* ignore */
        }
      }
    };
    addEventListener("pointermove", onMove);
    addEventListener("pointerup", onRelease);
    return () => {
      removeEventListener("pointermove", onMove);
      removeEventListener("pointerup", onRelease);
    };
  }, []);

  /** Ramène l'élément dans la fenêtre — après un resize du panneau lui-même. */
  const reclamp = useCallback((): void => {
    const el = element.current;
    setPosition((p) => clampToWindow(p, el?.offsetWidth ?? 0, el?.offsetHeight ?? 0));
  }, []);

  // Un panneau laissé hors écran après un redimensionnement serait
  // irrécupérable : on le ramène.
  useEffect(() => {
    addEventListener("resize", reclamp);
    return () => removeEventListener("resize", reclamp);
  }, [reclamp]);

  return { position, element, onPointerDown, hasDragged, reclamp };
}
