import { useEffect, useRef, useState } from "react";

/** Ce que le badge doit montrer. */
export type FlashKind = "pause" | "play" | "mute" | "unmute";

export interface PlaybackFlash {
  kind: FlashKind;
  /** Identité du flash, pour que React rejoue l'animation à chaque bascule. */
  id: number;
}

/** Le temps que le badge reste à l'écran, animation de sortie comprise. */
const DUREE_MS = 700;

/**
 * Le retour visuel des bascules du lecteur — pendant du badge « +30s ».
 *
 * # Pourquoi un hook et pas un simple booléen
 *
 * Ce qu'on montre n'est pas un ÉTAT mais un ÉVÈNEMENT : « on vient de mettre en
 * pause », « on vient de couper le son ». Rendre l'icône tant que la vidéo est
 * en pause la laisserait plantée au milieu de l'image pendant qu'on lit le
 * synopsis ; la lier à l'état seul ne marche donc pas.
 *
 * ⚠️ Rien ne s'affiche avant que la lecture n'ait RÉELLEMENT commencé, et ce
 * n'est pas la même chose que « la première valeur est ignorée ». Un lecteur qui
 * monte passe par `paused: true` — personne n'a rien demandé — puis par
 * `paused: false` quand la vidéo démarre : cette seconde étape est une bascule
 * comme une autre, et elle affichait une icône de lecture à l'ouverture de
 * chaque film. Ce n'en est pas une : c'est le démarrage. Le hook ne s'arme donc
 * qu'à ce moment-là, et n'annonce que ce qui vient APRÈS.
 *
 * De même, un son restauré depuis les préférences n'est pas une coupure.
 *
 * Un seul badge à la fois : deux bascules simultanées sont si rares que le
 * dernier gagne, plutôt que d'empiler deux icônes au même endroit.
 */
export function usePlaybackFlash(paused: boolean, muted: boolean): PlaybackFlash | null {
  const [flash, setFlash] = useState<PlaybackFlash | null>(null);
  const precedent = useRef<{ paused: boolean; muted: boolean } | null>(null);
  /** La lecture a-t-elle démarré une première fois ? Voir l'en-tête. */
  const demarree = useRef(false);
  const compteur = useRef(0);
  const minuteur = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const avant = precedent.current;
    precedent.current = { paused, muted };
    if (!demarree.current) {
      // Le passage à « en lecture » n'est pas une bascule, c'est le démarrage :
      // on s'arme sans rien annoncer.
      if (!paused) demarree.current = true;
      return;
    }
    if (avant === null) return;

    let kind: FlashKind | null = null;
    if (avant.paused !== paused) kind = paused ? "pause" : "play";
    else if (avant.muted !== muted) kind = muted ? "mute" : "unmute";
    if (kind === null) return;

    compteur.current += 1;
    setFlash({ kind, id: compteur.current });
    clearTimeout(minuteur.current);
    minuteur.current = setTimeout(() => setFlash(null), DUREE_MS);
  }, [paused, muted]);

  useEffect(() => () => clearTimeout(minuteur.current), []);

  return flash;
}
