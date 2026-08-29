/**
 * L'HORLOGE du lecteur web — et la base de temps du conteneur.
 *
 * Deux choses qui n'en font qu'une : ce que la barre affiche, et ce qu'il faut
 * lui retrancher pour que « 0 » soit le début du film.
 *
 * # Le battement à 1 Hz
 *
 * `onTimeUpdate` arrive à ~4 Hz. Rendre à cette cadence, avec l'habillage, la
 * barre de progression et l'arbitre de segments derrière, ne sert à rien : une
 * horloge à la seconde ne montre rien de plus. `rawTimeRef` reçoit donc chaque
 * mise à jour, et seul `displayTime` déclenche un rendu, une fois par seconde.
 *
 * # Les décalages de PTS
 *
 * `CopyTimestamps=true` conserve la base PTS du conteneur d'origine, et
 * certains médias ne partent pas de zéro (un enregistrement de diffusion,
 * mesuré à 677 s). `effectiveOffsetRef` est ce qu'on retranche pour afficher
 * une position de film ; `containerPtsOffsetRef` garde le décalage brut, celui
 * qu'il faut RAJOUTER pour convertir une cible de saut en PTS.
 *
 * Extrait de `VideoPlayer.tsx` pour le ramener sous les 300 lignes : les six
 * valeurs se tiennent, et aucune n'a de sens seule.
 */

import { useEffect, useRef, useState, type MutableRefObject } from "react";

export interface VideoClock {
  /** La position brute, écrite à chaque `onTimeUpdate` — jamais rendue. */
  rawTimeRef: MutableRefObject<number>;
  /** La position affichable, rafraîchie à 1 Hz. */
  displayTime: number;
  /** Dernière position connue, conservée à travers un changement de source. */
  lastKnownPositionRef: MutableRefObject<number>;
  /** À RETRANCHER de la position brute pour obtenir la position du film. */
  effectiveOffsetRef: MutableRefObject<number>;
  /** Le décalage brut du conteneur, à rajouter pour viser en PTS. */
  containerPtsOffsetRef: MutableRefObject<number>;
  /** Le décalage a-t-il été mesuré pour la source courante ? */
  offsetDetectedRef: MutableRefObject<boolean>;
}

export function useVideoClock(): VideoClock {
  const rawTimeRef = useRef(0);
  const [displayTime, setDisplayTime] = useState(0);
  const lastKnownPositionRef = useRef(0);
  const effectiveOffsetRef = useRef(0);
  const containerPtsOffsetRef = useRef(0);
  const offsetDetectedRef = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setDisplayTime(rawTimeRef.current), 1000);
    return () => clearInterval(id);
  }, []);

  return {
    rawTimeRef,
    displayTime,
    lastKnownPositionRef,
    effectiveOffsetRef,
    containerPtsOffsetRef,
    offsetDetectedRef,
  };
}
