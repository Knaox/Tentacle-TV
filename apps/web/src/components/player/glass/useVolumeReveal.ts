import { useCallback, useEffect, useMemo, useRef, useState, type FocusEvent } from "react";

/**
 * Le temps pendant lequel la capsule pose sa région SANS transition native après que le
 * curseur du volume a paru ou est parti : la mise en page du rendu, l'image où la primitive
 * relit le rectangle, l'acheminement à la coquille — et une marge.
 */
export const VOLUME_RESHAPE_MS = 240;

interface VolumeReveal {
  /** Le curseur du volume est à l'écran (survol ou focus de son groupe). */
  open: boolean;
  /** La capsule vient de changer de largeur : région posée à l'instant (`GlassSurface instant`). */
  reshaping: boolean;
  handlers: {
    onPointerEnter: () => void;
    onPointerLeave: () => void;
    onFocus: () => void;
    onBlur: (event: FocusEvent<HTMLElement>) => void;
  };
}

/**
 * Le curseur du volume du lecteur en verre : il paraît au survol ou au focus de son groupe,
 * comme dans l'habillage sans verre (`.pl-volume`, où une règle `:hover` suffit).
 *
 * Ici c'est un ÉTAT : la capsule de verre s'élargit avec lui, et sa région native a une
 * transition (celle de sa matérialisation) — la coquille rejouerait le changement de cadre au
 * ressort, le verre arrivant 340 ms après le curseur. L'ouverture et `reshaping` partent dans
 * le MÊME rendu : la région connaît sa transition nulle avant de relire son rectangle.
 */
export function useVolumeReveal(): VolumeReveal {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reshaping, setReshaping] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reshape = useCallback(() => {
    setReshaping(true);
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      setReshaping(false);
    }, VOLUME_RESHAPE_MS);
  }, []);

  useEffect(() => () => {
    if (timer.current !== null) clearTimeout(timer.current);
  }, []);

  const handlers = useMemo(() => ({
    onPointerEnter: () => { setHovered(true); reshape(); },
    onPointerLeave: () => { setHovered(false); reshape(); },
    onFocus: () => { setFocused(true); reshape(); },
    onBlur: (event: FocusEvent<HTMLElement>) => {
      // Le focus passe du bouton au curseur : le groupe le garde.
      if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
      setFocused(false);
      reshape();
    },
  }), [reshape]);

  return { open: hovered || focused, reshaping, handlers };
}
