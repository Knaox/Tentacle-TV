import { TRAILER_PREVIEW_TIMING } from "@tentacle-tv/shared";

/**
 * Le pointeur BOUGE-t-il encore ? L'intention de l'aperçu (`previewMachine.ts`,
 * shared) attend qu'il s'arrête sur la carte : chaque mouvement au-delà de
 * `intentMovePx` depuis le dernier point retenu, et chaque coup de molette (la
 * page défile sous lui), repousse la demande au serveur.
 *
 * Les écouteurs ne vivent que tant qu'une carte attend son intention (une à la
 * fois, en pratique) : rien n'écoute au repos. Le premier mouvement après
 * l'abonnement fixe le point de départ sans compter — le geste qui amène le
 * pointeur sur la carte a déjà ouvert l'intention.
 */
type Listener = () => void;

const listeners = new Set<Listener>();
let anchorX = Number.NaN;
let anchorY = Number.NaN;

function notify(): void {
  for (const listener of listeners) listener();
}

function onPointerMove(e: PointerEvent): void {
  if (!Number.isFinite(anchorX)) {
    anchorX = e.clientX;
    anchorY = e.clientY;
    return;
  }
  if (Math.hypot(e.clientX - anchorX, e.clientY - anchorY) <= TRAILER_PREVIEW_TIMING.intentMovePx) return;
  anchorX = e.clientX;
  anchorY = e.clientY;
  notify();
}

function onWheel(): void {
  notify();
}

/** S'abonne aux mouvements qui comptent ; rend le désabonnement. */
export function subscribePointerMotion(listener: Listener): () => void {
  if (typeof window === "undefined" || typeof window.addEventListener !== "function") return () => undefined;
  if (listeners.size === 0) {
    anchorX = Number.NaN;
    anchorY = Number.NaN;
    window.addEventListener("pointermove", onPointerMove, { passive: true, capture: true });
    window.addEventListener("wheel", onWheel, { passive: true, capture: true });
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    window.removeEventListener("pointermove", onPointerMove, true);
    window.removeEventListener("wheel", onWheel, true);
  };
}
