import { useEffect, useState } from "react";

/** Les premières lignes : un écran de téléphone, et un peu plus. */
const FIRST_BATCH = 12;
/** Les suivantes, par lot et par image d'animation — le fil JS respire entre deux. */
const NEXT_BATCH = 24;

/**
 * Combien de lignes monter maintenant, pour une liste qui vit dans le
 * défilement de sa page (pas de virtualisation possible dans une `ScrollView`).
 *
 * Une saison de 196 épisodes montait ses 196 lignes d'un seul rendu — images,
 * animations, abonnements au cache : le fil JS restait pris des centaines de
 * millisecondes, et la saison n'apparaissait qu'à la fin. Désormais les
 * premières lignes arrivent tout de suite et les suivantes par lots, une
 * image d'animation après l'autre, jusqu'au bout. Même recette que la liste de
 * la fiche du téléviseur (`TVEpisodePageList`).
 *
 * `mustInclude` : un index qui doit faire partie du premier lot (l'épisode
 * courant, vers lequel la page défile). `resetKey` : repartir du premier lot
 * (une autre saison).
 */
export function useProgressiveCount(total: number, resetKey: string, mustInclude = -1): number {
  const first = Math.min(total, Math.max(FIRST_BATCH, mustInclude + 1));
  const [state, setState] = useState({ key: resetKey, count: first });
  // Nouvelle saison : on repart du premier lot DANS le même rendu (pas d'image
  // intermédiaire avec les lignes de la saison précédente).
  const count = state.key === resetKey ? Math.max(state.count, first) : first;
  if (state.key !== resetKey) setState({ key: resetKey, count: first });

  useEffect(() => {
    if (count >= total) return;
    const frame = requestAnimationFrame(() => {
      setState((prev) => (prev.key === resetKey ? { key: resetKey, count: Math.min(total, prev.count + NEXT_BATCH) } : prev));
    });
    return () => cancelAnimationFrame(frame);
  }, [count, total, resetKey]);

  return Math.min(count, total);
}
