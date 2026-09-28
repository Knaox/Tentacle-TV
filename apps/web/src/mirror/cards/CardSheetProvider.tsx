import { useCallback, useState, type ReactNode } from "react";
import { CardSheetContext, type CardSheetTarget } from "./cardSheet";
import { MediaActionSheet } from "./MediaActionSheet";

/**
 * L'hôte de LA feuille d'appui long d'un écran : une seule feuille, que
 * toutes ses cartes ouvrent d'elles-mêmes (`useOpenCardSheet`) — l'affiche
 * d'une rangée, d'une grille, d'un rail de recherche, d'une filmographie.
 *
 * L'état vit ici, pas dans l'écran : ouvrir la feuille ne re-rend que
 * l'hôte et la feuille (les enfants reçus en `children` ne bougent pas), et
 * le contexte ne change jamais — `setTarget` est stable.
 */
export function CardSheetProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<CardSheetTarget | null>(null);
  const close = useCallback(() => setTarget(null), []);
  return (
    <CardSheetContext.Provider value={setTarget}>
      {children}
      <MediaActionSheet target={target} onClose={close} />
    </CardSheetContext.Provider>
  );
}
