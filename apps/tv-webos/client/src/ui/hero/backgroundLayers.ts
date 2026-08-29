import { useCallback, useEffect, useState } from "react";

/**
 * Les calques du fond au focus, et l'ordre dans lequel ils se remplacent.
 *
 * **Pourquoi une machine plutôt qu'une clé de remontage.** La version
 * précédente rendait un seul calque, keyé sur l'URL de l'image : changer de
 * cible démontait l'ancien et montait le nouveau. Entre les deux, l'écran était
 * noir — et pas d'un cheveu, mais le temps de télécharger un Backdrop de 1280
 * de large. Un fondu croisé demande que les deux coexistent : l'ancien tient
 * l'écran jusqu'à ce que le nouveau soit prêt à le prendre.
 *
 * Deux calques au plus, jamais trois. Balayer une rangée à toute vitesse ne
 * doit pas empiler une composition par carte franchie — c'est la première règle
 * de coût du projet, et un processeur de dalle la fait respecter de lui-même.
 * Quand un troisième se présente, le plus ancien saute sans cérémonie.
 *
 * L'ordre du tableau est l'ordre d'empilement : le dernier est au-dessus. Le
 * calque entrant monte donc en opacité PAR-DESSUS le sortant, ce qui évite le
 * creux qu'on verrait si les deux se croisaient à mi-course.
 */

export interface BackdropLayer {
  /** L'URL de l'image — c'est aussi son identité de rendu. */
  url: string;
  /** Vrai quand le calque s'efface : plus rien à afficher derrière lui. */
  leaving: boolean;
}

interface BackdropLayers {
  layers: BackdropLayer[];
  /** Le fondu d'entrée est terminé : ce calque tient l'écran, seul. */
  reportEntered: (url: string) => void;
  /** Le fondu de sortie est terminé : le calque peut être démonté. */
  reportExited: (url: string) => void;
}

export function useBackdropLayers(url: string | null): BackdropLayers {
  const [layers, setLayers] = useState<BackdropLayer[]>([]);

  useEffect(() => {
    setLayers((currents) => next(currents, url));
  }, [url]);

  const reportEntered = useCallback((entered: string) => {
    setLayers((currents) => {
      const index = currents.findIndex((layer) => layer.url === entered);
      // Tout ce qui était dessous n'a plus de raison d'être : le calque entrant
      // est désormais opaque et le recouvre entièrement.
      return index <= 0 ? currents : currents.slice(index);
    });
  }, []);

  const reportExited = useCallback((exited: string) => {
    setLayers((currents) => currents.filter((layer) => layer.url !== exited));
  }, []);

  return { layers, reportEntered, reportExited };
}

/**
 * L'état suivant, en fonction de l'image demandée.
 *
 * Fonction pure, hors du composant : c'est la seule partie qui décide, elle se
 * lit d'un bloc, et `calquesFond.test.ts` la vérifie — ce qu'on ne pourrait pas
 * faire d'un enchaînement de rendus.
 */
export function next(currents: BackdropLayer[], url: string | null): BackdropLayer[] {
  if (url === null) {
    if (currents.length === 0) return currents;
    if (currents.every((layer) => layer.leaving)) return currents;
    return currents.map((layer) => ({ url: layer.url, leaving: true }));
  }

  const last = currents[currents.length - 1];

  // Déjà à l'écran : ne rien faire. C'est ce qui garde le fond IMMOBILE quand
  // on passe d'un épisode au suivant — les deux empruntent le Backdrop de la
  // même série, donc la même URL, et il n'y a rien à remplacer.
  if (last && last.url === url && !last.leaving) return currents;

  // Le même calque revient alors qu'il s'effaçait : on annule son départ
  // plutôt que d'en monter un second sur la même image.
  if (last && last.url === url) {
    return currents.slice(0, -1).concat([{ url, leaving: false }]);
  }

  const kept = currents.filter((layer) => !layer.leaving).slice(-1);
  return kept.concat([{ url, leaving: false }]);
}
