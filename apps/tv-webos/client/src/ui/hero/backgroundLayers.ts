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

export interface CalqueFond {
  /** L'URL de l'image — c'est aussi son identité de rendu. */
  url: string;
  /** Vrai quand le calque s'efface : plus rien à afficher derrière lui. */
  sortant: boolean;
}

interface CalquesFond {
  calques: CalqueFond[];
  /** Le fondu d'entrée est terminé : ce calque tient l'écran, seul. */
  signalerEntre: (url: string) => void;
  /** Le fondu de sortie est terminé : le calque peut être démonté. */
  signalerSorti: (url: string) => void;
}

export function useCalquesFond(url: string | null): CalquesFond {
  const [calques, setCalques] = useState<CalqueFond[]>([]);

  useEffect(() => {
    setCalques((actuels) => suivant(actuels, url));
  }, [url]);

  const signalerEntre = useCallback((entre: string) => {
    setCalques((actuels) => {
      const index = actuels.findIndex((calque) => calque.url === entre);
      // Tout ce qui était dessous n'a plus de raison d'être : le calque entrant
      // est désormais opaque et le recouvre entièrement.
      return index <= 0 ? actuels : actuels.slice(index);
    });
  }, []);

  const signalerSorti = useCallback((sorti: string) => {
    setCalques((actuels) => actuels.filter((calque) => calque.url !== sorti));
  }, []);

  return { calques, signalerEntre, signalerSorti };
}

/**
 * L'état suivant, en fonction de l'image demandée.
 *
 * Fonction pure, hors du composant : c'est la seule partie qui décide, elle se
 * lit d'un bloc, et `calquesFond.test.ts` la vérifie — ce qu'on ne pourrait pas
 * faire d'un enchaînement de rendus.
 */
export function suivant(actuels: CalqueFond[], url: string | null): CalqueFond[] {
  if (url === null) {
    if (actuels.length === 0) return actuels;
    if (actuels.every((calque) => calque.sortant)) return actuels;
    return actuels.map((calque) => ({ url: calque.url, sortant: true }));
  }

  const dernier = actuels[actuels.length - 1];

  // Déjà à l'écran : ne rien faire. C'est ce qui garde le fond IMMOBILE quand
  // on passe d'un épisode au suivant — les deux empruntent le Backdrop de la
  // même série, donc la même URL, et il n'y a rien à remplacer.
  if (dernier && dernier.url === url && !dernier.sortant) return actuels;

  // Le même calque revient alors qu'il s'effaçait : on annule son départ
  // plutôt que d'en monter un second sur la même image.
  if (dernier && dernier.url === url) {
    return actuels.slice(0, -1).concat([{ url, sortant: false }]);
  }

  const socle = actuels.filter((calque) => !calque.sortant).slice(-1);
  return socle.concat([{ url, sortant: false }]);
}
