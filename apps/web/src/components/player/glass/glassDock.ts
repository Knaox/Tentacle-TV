import { createContext, useContext } from "react";

/**
 * Le dock du lecteur en verre (`.lgp-dock`) : le bloc où se calent ses
 * popovers (`.lgp-popover`, au-dessus du bord droit des capsules).
 *
 * Un popover rendu DANS une capsule y reste coincé : la transformée de son
 * apparition et de son masquage (`.lgp-content`) fait de la capsule son bloc
 * conteneur, à la place du dock. Mesuré sur le panneau de vitesse : à chaque
 * masquage des contrôles, il glissait de 66 px vers le bas en rétrécissant, et
 * remontait d'autant au retour. Qui ouvre un popover depuis une capsule le
 * PORTE donc ici (`createPortal`) ; `null` tant que le dock n'est pas monté.
 */
export const GlassDockContext = createContext<HTMLElement | null>(null);

export function useGlassDock(): HTMLElement | null {
  return useContext(GlassDockContext);
}
