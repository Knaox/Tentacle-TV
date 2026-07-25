import { useCallback, useEffect, useRef, useState } from "react";

/**
 * « Présent dans le DOM uniquement pendant le survol » — sans perdre le fondu
 * de sortie.
 *
 * Pourquoi ce hook existe : un élément porteur d'un `backdrop-filter` ne coûte
 * PAS zéro quand on le masque par `opacity: 0`. Sous WebKit comme sous Chromium
 * la couche composée subsiste, son arrière-plan est recopié et son flou
 * recalculé à chaque image — pour un voile que personne ne voit. Le constat est
 * déjà documenté dans ce dépôt (`components/media/CardMetaOverlay.tsx`), et il
 * devient franchement coûteux quand le fond derrière l'élément BOUGE : sur la
 * bannière d'accueil, dont l'image zoome en permanence, le flou de deux flèches
 * invisibles est refait cent vingt fois par seconde.
 *
 * Le démontage brut, lui, supprime le fondu de sortie — l'élément disparaît
 * d'un coup. D'où les deux états retournés :
 *
 *   • `hovered` — la cible visée, à refléter dans le style (opacité 0 ou 1) ;
 *   • `mounted` — la présence dans le DOM, qui SURVIT à la sortie le temps que
 *     le fondu se joue.
 *
 * Le fondu d'ENTRÉE, lui, ne peut pas être une transition ordinaire : au
 * montage il n'existe aucun état précédent d'où partir. Il se déclare en CSS
 * avec `@starting-style` du côté de l'appelant — même recette que
 * `.fade-in-on-mount` (`theme/rendering.css`).
 *
 * @param exitMs Durée du fondu de sortie, en millisecondes. Doit valoir
 *   exactement celle de la transition CSS, sans quoi l'élément est retiré avant
 *   la fin du fondu (coupure nette) ou reste monté pour rien après (le coût que
 *   ce hook existe précisément pour supprimer).
 */
export function useHoverMount(exitMs: number) {
  const [hovered, setHovered] = useState(false);
  const [mounted, setMounted] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    clearTimeout(timer.current);
    if (hovered) {
      setMounted(true);
      return;
    }
    // `setMounted(false)` sur un état déjà faux ne provoque aucun rendu (React
    // court-circuite), le cas du tout premier passage est donc gratuit.
    timer.current = setTimeout(() => setMounted(false), exitMs);
    return () => clearTimeout(timer.current);
  }, [hovered, exitMs]);

  // Les deux gestionnaires sont stables : ils passent en props à des composants
  // mémoïsés, une nouvelle identité à chaque rendu les re-rendrait pour rien.
  const onMouseEnter = useCallback(() => setHovered(true), []);
  const onMouseLeave = useCallback(() => setHovered(false), []);

  return { hovered, mounted, onMouseEnter, onMouseLeave };
}
