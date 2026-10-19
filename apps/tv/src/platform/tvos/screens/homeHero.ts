import { useRef } from "react";
import type { FocusExtras, FocusStore } from "../focus/focusStore";

/**
 * L'applicateur de la BANNIÈRE à une cible (tv-core `hero/heroNav.ts`) : le
 * focus RETENU à gauche tant que GAUCHE y tourne la bannière vers le titre
 * précédent — sans lui, le rail prendrait le focus. Sur le premier titre, rien
 * n'est retenu : GAUCHE va au rail, comme depuis la première carte d'une rangée.
 *
 * Le piège est une prop native de la section de la bannière (`section:hero`),
 * reliée par le port avant que la vue ne se dessine ; la même sur Apple TV et
 * Android TV.
 */

export const HERO_SECTION_KEY = "section:hero";

const TRAP_LEFT: FocusExtras = { native: { trapFocusLeft: true } };

export function useHeroEdgeTrap(focus: FocusStore, trapLeft: boolean): void {
  // Lié pendant le rendu de l'écran : la section, rendue après, lit la liaison à jour.
  const bound = useRef<boolean | null>(null);
  if (bound.current !== trapLeft) {
    bound.current = trapLeft;
    focus.bind(HERO_SECTION_KEY, trapLeft ? TRAP_LEFT : null);
  }
}
