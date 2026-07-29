import { useEffect, useRef, useState } from "react";

export interface PlaybackFlash {
  /** L'état ATTEINT : `true` si l'on vient de mettre en pause. */
  paused: boolean;
  /** Identité du flash, pour que React rejoue l'animation à chaque bascule. */
  id: number;
}

/** Le temps que le badge reste à l'écran, animation de sortie comprise. */
const DUREE_MS = 700;

/**
 * Le retour visuel d'une bascule lecture/pause — pendant du badge « +30s ».
 *
 * # Pourquoi un hook et pas un simple booléen
 *
 * Ce qu'on veut montrer n'est pas un ÉTAT mais un ÉVÈNEMENT : « on vient de
 * mettre en pause ». Rendre l'icône tant que la vidéo est en pause la laisserait
 * plantée au milieu de l'image pendant qu'on lit le synopsis ; la lier à l'état
 * seul ne marche donc pas.
 *
 * ⚠️ La première valeur ne déclenche RIEN. Un lecteur qui monte alors que la
 * lecture n'a pas encore démarré passe par `paused: true` sans que personne
 * n'ait rien demandé, et un badge « pause » s'affichait alors à l'ouverture de
 * chaque épisode. Seules les bascules SUIVANTES comptent.
 */
export function usePlaybackFlash(paused: boolean): PlaybackFlash | null {
  const [flash, setFlash] = useState<PlaybackFlash | null>(null);
  const precedent = useRef<boolean | null>(null);
  const compteur = useRef(0);
  const minuteur = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (precedent.current === null || precedent.current === paused) {
      precedent.current = paused;
      return;
    }
    precedent.current = paused;
    compteur.current += 1;
    setFlash({ paused, id: compteur.current });
    clearTimeout(minuteur.current);
    minuteur.current = setTimeout(() => setFlash(null), DUREE_MS);
  }, [paused]);

  useEffect(() => () => clearTimeout(minuteur.current), []);

  return flash;
}
