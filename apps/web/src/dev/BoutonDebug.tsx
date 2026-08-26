/**
 * Le bouton DEBUG — déplaçable, et sa position s'en souvient.
 *
 * Extrait de `PlayerDebugPanel` : le bouton a désormais son propre glisser
 * (`saisirBoutons` — la garde anti-boutons de `usePanelDrag` l'aurait rendu
 * inamovible), et le clic qui SUIT un déplacement est avalé (`aGlisse`, modèle
 * `ChatOverlay`) : lâcher le bouton ne doit pas ouvrir le panneau.
 *
 * Ancré en bas-droite par défaut via une position CALCULÉE (l'ancrage
 * bottom/right de l'ancien bouton est incompatible avec `contenir()`, qui
 * raisonne en left/top) ; une fois déplacé, la position mémorisée gagne.
 */

import { usePanelDrag } from "./usePanelDrag";

/** Taille approximative du bouton, pour le poser en bas-droite au départ. */
const LARGEUR = 62;
const HAUTEUR = 26;

function positionDefaut() {
  if (typeof window === "undefined") return { x: 16, y: 16 };
  return { x: window.innerWidth - LARGEUR - 12, y: window.innerHeight - HAUTEUR - 12 };
}

export function BoutonDebug({ onOuvrir }: { onOuvrir: () => void }) {
  const { position, element, onPointerDown, aGlisse } = usePanelDrag(positionDefaut(), {
    cle: "tentacle_debug_bouton_pos",
    saisirBoutons: true,
  });
  return (
    <button
      ref={(el) => {
        element.current = el;
      }}
      onPointerDown={onPointerDown}
      onClick={() => {
        if (aGlisse.current) return;
        onOuvrir();
      }}
      style={{ left: position.x, top: position.y }}
      className="fixed z-[9999] cursor-move rounded-md bg-black/80 px-2.5 py-1 font-mono text-[10px] font-bold tracking-wider text-emerald-400 ring-1 ring-emerald-400/40 transition hover:bg-black"
      title="Diagnostic du lecteur (F9) — développement uniquement. Glisser pour déplacer."
    >
      DEBUG
    </button>
  );
}
