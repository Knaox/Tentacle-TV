import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { PipGesture } from "./pictureInPictureContext";

/**
 * La souris dans la fenêtre PiP : quand montrer les contrôles, et les gestes.
 *
 * AUCUNE zone `app-region: drag` : au-dessus d'une telle zone, Electron ne
 * transmet plus rien à la page — ni survol, ni molette, ni double-clic, et un
 * `mouseleave` dès que le curseur y entre (banc du 09.10.2026). Les contrôles
 * ne paraissaient qu'au survol d'un bouton. La page garde donc toute la
 * souris ; glisser et tirer un coin sont des gestes qu'elle ANNONCE, et que la
 * colle KWin exécute en suivant le curseur (`onGesture` → `pip_gesture`).
 *
 * - survol : les contrôles paraissent au moindre mouvement, s'effacent quand
 *   la souris quitte la fenêtre ou ne bouge plus — jamais sur un bouton ;
 * - glisser : un appui sur la vidéo qui bouge de quelques points (en deçà,
 *   c'est un clic : le double-clic ramène au lecteur) ;
 * - un coin : l'appui suffit, la colle garde fixe le coin opposé.
 *
 * Le bouton reste tenu par la page (capture du pointeur, prise implicite de
 * Wayland) : le relâcher, ou la perte de la capture, finit le geste.
 */

/** Sans mouvement, les contrôles s'effacent. */
const IDLE_MS = 2500;
/** En deçà, un appui reste un clic. */
const MOVE_THRESHOLD_PX = 4;

export type PipCorner = Exclude<PipGesture, "move">;

interface Press {
  pointerId: number;
  x: number;
  y: number;
  gesture: PipGesture | null;
}

/** Un nœud de la fenêtre PiP — autre royaume JavaScript : jamais `instanceof Element`. */
function onControl(target: EventTarget | null): boolean {
  const closest = (target as { closest?: (selector: string) => unknown } | null)?.closest;
  return typeof closest === "function" && closest.call(target, "button") !== null;
}

type OnGesture = (gesture: PipGesture | null, grab?: { x: number; y: number }) => void;

export function usePipPointer(view: Window | null, canMove: boolean, onGesture: OnGesture) {
  const [hovered, setHovered] = useState(false);
  const [gesture, setGesture] = useState<PipGesture | null>(null);
  const press = useRef<Press | null>(null);
  const onGestureRef = useRef(onGesture);
  onGestureRef.current = onGesture;

  // Le survol, écouté sur le document de la fenêtre PiP.
  useEffect(() => {
    if (view === null) return;
    const doc = view.document;
    let idle: number | undefined;
    const wake = (event: MouseEvent) => {
      setHovered(true);
      view.clearTimeout(idle);
      if (!onControl(event.target)) idle = view.setTimeout(() => setHovered(false), IDLE_MS);
    };
    // `relatedTarget` nul : la souris a quitté la fenêtre.
    const leave = (event: MouseEvent) => {
      if (event.relatedTarget !== null) return;
      view.clearTimeout(idle);
      setHovered(false);
    };
    doc.addEventListener("mousemove", wake);
    doc.addEventListener("mousedown", wake);
    doc.addEventListener("mouseout", leave);
    return () => {
      view.clearTimeout(idle);
      doc.removeEventListener("mousemove", wake);
      doc.removeEventListener("mousedown", wake);
      doc.removeEventListener("mouseout", leave);
    };
  }, [view]);

  const begin = useCallback((next: PipGesture) => {
    const current = press.current;
    if (current !== null) current.gesture = next;
    setGesture(next);
    // Glisser : le point saisi, que la colle garde sous le curseur.
    if (next === "move" && current !== null) onGestureRef.current(next, { x: current.x, y: current.y });
    else onGestureRef.current(next);
  }, []);

  const end = useCallback(() => {
    const ended = press.current;
    press.current = null;
    if (ended?.gesture == null) return;
    setGesture(null);
    onGestureRef.current(null);
  }, []);

  // Un PiP refermé en plein geste : la colle cesse de suivre le curseur.
  useEffect(() => end, [end]);

  const capture = (event: ReactPointerEvent<HTMLElement>, gesture: PipGesture | null) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    press.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, gesture };
  };

  /** La vidéo et son liseré : un appui qui bouge glisse la fenêtre. */
  const surface = {
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0 || !canMove || onControl(event.target)) return;
      capture(event, null);
    },
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
      const current = press.current;
      if (current === null || current.pointerId !== event.pointerId || current.gesture !== null) return;
      if (Math.hypot(event.clientX - current.x, event.clientY - current.y) < MOVE_THRESHOLD_PX) return;
      begin("move");
    },
    onPointerUp: end,
    onPointerCancel: end,
    onLostPointerCapture: end,
  };

  /** Un coin : l'appui commence le geste. */
  const grip = (corner: PipCorner) => ({
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      capture(event, null);
      begin(corner);
    },
    onPointerUp: end,
    onPointerCancel: end,
    onLostPointerCapture: end,
  });

  return { hovered, gesture, surface, grip, onControl };
}
