import type { ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Le cadre des barres de sélection (Ma liste, Mes favoris, épisodes d'une saison) : une
 * CAPSULE opaque qui flotte en bas de la fenêtre, le compte à gauche, les gestes à droite.
 *
 * Elle était une bande pleine largeur à 0,9 d'alpha sous un `backdrop-filter` : un flou
 * recalculé à chaque image du défilement pour ne rien montrer (docs/REFONTE-UI.md, § 7). La peau
 * de l'avis du socle (`.ui-toast`) la remplace — une encre pleine et une ombre, sans flou.
 * Rendue dans `document.body` : aucun parent en `overflow: hidden` ne la rogne.
 *
 * Sous le verre natif, `lg-bar` en fait le verre épais (`lgOverlays.css`) : même forme, même
 * place — le verre change le matériau, jamais les dimensions.
 *
 * L'entrée (12 px et un fondu, la durée d'un menu) lit les jetons de durée du socle : sous
 * « réduire les animations », ils tombent à zéro.
 */
export function SelectionBarFrame({ status, children }: {
  /** Le compte de la sélection. */
  status: ReactNode;
  /** Les gestes, dans l'ordre : choisir, quitter, agir. */
  children: ReactNode;
}) {
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 md:bottom-6">
      <div
        role="toolbar"
        className="lg-bar selection-bar ui-toast pointer-events-auto max-w-full flex-wrap justify-between gap-x-5 gap-y-2 rounded-panel py-2 pl-5 pr-2"
      >
        <span className="lg-fb-status text-sm font-semibold tabular-nums text-content-primary" aria-live="polite">
          {status}
        </span>
        <div className="flex flex-wrap items-center gap-1.5">{children}</div>
      </div>
      <style>{`@keyframes selectionBarIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
.selection-bar { animation: selectionBarIn var(--duration-menu-in) var(--ease-out); }`}</style>
    </div>,
    document.body,
  );
}
