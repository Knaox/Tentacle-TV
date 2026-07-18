import { useCallback, useEffect, useMemo, useRef, useState, type FocusEvent } from "react";

// Fenêtre de grâce après un geste sans survol persistant (tap tactile, clic
// émoji en rafale, wheel sur la grille GIFs) : le pointerenter/leave ne suffit
// pas sur tactile (leave émis à la fin du touch) ni pour un curseur immobile.
const GRACE_MS = 4000;

export interface ChatActivity {
  /** L'utilisateur interagit avec le chat (survol, geste récent, focus interne). */
  active: boolean;
  /** À étaler sur le(s) conteneur(s) racine de l'overlay (panneau ET bulle). */
  handlers: {
    onPointerEnter: () => void;
    onPointerLeave: () => void;
    onPointerDownCapture: () => void;
    onWheelCapture: () => void;
    onFocusCapture: () => void;
    onBlurCapture: (e: FocusEvent) => void;
  };
}

/**
 * Signal « chat actif » consommé par ChatOverlay pour NE PAS masquer le chat
 * avec les contrôles du lecteur pendant une interaction. Le chat vit dans un
 * portail HORS du conteneur vidéo (document.body en fenêtré) : ses événements
 * ne réarment jamais le timer d'inactivité du lecteur — sans ce garde, le chat
 * s'évanouissait en plein spam d'émojis ou scroll de GIFs.
 */
export function useChatActivity(): ChatActivity {
  const [pointerOver, setPointerOver] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [grace, setGrace] = useState(false);
  const graceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const touchGrace = useCallback(() => {
    setGrace(true);
    if (graceTimer.current) clearTimeout(graceTimer.current);
    graceTimer.current = setTimeout(() => {
      graceTimer.current = null;
      setGrace(false);
    }, GRACE_MS);
  }, []);

  useEffect(() => () => {
    if (graceTimer.current) clearTimeout(graceTimer.current);
  }, []);

  const onPointerEnter = useCallback(() => setPointerOver(true), []);
  const onPointerLeave = useCallback(() => setPointerOver(false), []);
  const onFocusCapture = useCallback(() => setFocusWithin(true), []);
  // Le focus reste-t-il dans le chat ? (bascule input texte → recherche GIF…)
  const onBlurCapture = useCallback((e: FocusEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setFocusWithin(false);
  }, []);

  const handlers = useMemo(() => ({
    onPointerEnter,
    onPointerLeave,
    onPointerDownCapture: touchGrace,
    onWheelCapture: touchGrace,
    onFocusCapture,
    onBlurCapture,
  }), [onPointerEnter, onPointerLeave, touchGrace, onFocusCapture, onBlurCapture]);

  return { active: pointerOver || focusWithin || grace, handlers };
}
