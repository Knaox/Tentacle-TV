/**
 * Le bouton DEBUG — déplaçable, et sa position s'en souvient.
 *
 * Le bouton a son propre glisser (`grabButtons` — la garde anti-boutons de `usePanelDrag`
 * l'aurait rendu inamovible), et le clic qui SUIT un déplacement est avalé (`hasDragged`,
 * modèle `ChatOverlay`) : lâcher le bouton ne doit pas ouvrir le panneau.
 *
 * Ancré en bas-droite par défaut via une position CALCULÉE (un ancrage bottom/right est
 * incompatible avec `clampToWindow()`, qui raisonne en left/top) ; une fois déplacé, la
 * position mémorisée gagne.
 */

import { usePanelDrag } from "./usePanelDrag";
import "./debugMenu/debugMenu.css";

/** Taille approximative du bouton, pour le poser en bas-droite au départ. */
const WIDTH = 72;
const HEIGHT = 26;

function defaultPosition() {
  if (typeof window === "undefined") return { x: 16, y: 16 };
  return { x: window.innerWidth - WIDTH - 12, y: window.innerHeight - HEIGHT - 12 };
}

export function DebugButton({ onOpen }: { onOpen: () => void }) {
  const { position, element, onPointerDown, hasDragged } = usePanelDrag(defaultPosition(), {
    key: "tentacle_debug_bouton_pos",
    grabButtons: true,
  });
  return (
    <button
      type="button"
      ref={(el) => {
        element.current = el;
      }}
      onPointerDown={onPointerDown}
      onClick={() => {
        if (hasDragged.current) return;
        onOpen();
      }}
      style={{ left: position.x, top: position.y }}
      className="dbg dbg-launch"
      title="Menu de débogage (F9). Glisser pour déplacer."
    >
      <span className="dbg-launch__dot" aria-hidden />
      DEBUG
    </button>
  );
}
