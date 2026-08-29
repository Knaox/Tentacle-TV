/**
 * Le bouton DEBUG — déplaçable, et sa position s'en souvient.
 *
 * Extrait de `PlayerDebugPanel` : le bouton a désormais son propre glisser
 * (`grabButtons` — la garde anti-boutons de `usePanelDrag` l'aurait rendu
 * inamovible), et le clic qui SUIT un déplacement est avalé (`hasDragged`, modèle
 * `ChatOverlay`) : lâcher le bouton ne doit pas ouvrir le panneau.
 *
 * Ancré en bas-droite par défaut via une position CALCULÉE (l'ancrage
 * bottom/right de l'ancien bouton est incompatible avec `clampToWindow()`, qui
 * raisonne en left/top) ; une fois déplacé, la position mémorisée gagne.
 */

import { usePanelDrag } from "./usePanelDrag";

/** Taille approximative du bouton, pour le poser en bas-droite au départ. */
const WIDTH = 62;
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
      ref={(el) => {
        element.current = el;
      }}
      onPointerDown={onPointerDown}
      onClick={() => {
        if (hasDragged.current) return;
        onOpen();
      }}
      style={{ left: position.x, top: position.y }}
      className="fixed z-[9999] cursor-move rounded-md bg-black/80 px-2.5 py-1 font-mono text-[10px] font-bold tracking-wider text-emerald-400 ring-1 ring-emerald-400/40 transition hover:bg-black"
      title="Diagnostic du lecteur (F9) — développement uniquement. Glisser pour déplacer."
    >
      DEBUG
    </button>
  );
}
