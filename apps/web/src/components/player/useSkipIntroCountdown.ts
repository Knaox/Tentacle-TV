import { useCallback, useEffect, useRef, useState } from "react";
import { useAutoSkipIntro } from "../../hooks/useAutoSkipIntro";

/**
 * Trois secondes : le temps de voir la pilule apparaître et d'y opposer la
 * croix, sans que l'attente n'annule l'intérêt d'avoir demandé le saut.
 */
export const DEPART_SAUT_INTRO = 3;

interface Options {
  /** Le bouton « Passer l'intro » est-il à l'écran ? */
  visible: boolean;
  /**
   * Change à chaque épisode — le début du segment d'intro suffit, il est déjà
   * descendu jusqu'ici. Sert à réarmer : une croix cliquée vaut pour l'épisode
   * en cours, pas pour toute la saison.
   */
  cle: number | undefined;
  /** Le saut lui-même, exactement le geste du clic sur la pilule. */
  sauter: () => void;
}

interface Etat {
  /** Secondes restantes, `null` quand aucun saut n'est armé. */
  compte: number | null;
  /** L'utilisateur s'y oppose : le décompte s'arrête pour cet épisode. */
  annuler: () => void;
}

/**
 * Le compte à rebours du saut d'intro automatique — partagé par les deux
 * moteurs de lecture (web HLS et desktop mpv).
 *
 * Il ne décide de rien d'autre que du décompte : c'est l'appelant qui sait si
 * le bouton est visible et comment déplacer la tête de lecture. Annuler ne fait
 * pas disparaître la pilule, elle retombe sur son libellé manuel — retirer le
 * bouton priverait du saut celui qui a seulement refusé de le subir.
 */
export function useSkipIntroCountdown({ visible, cle, sauter }: Options): Etat {
  const actif = useAutoSkipIntro();
  const [compte, setCompte] = useState<number | null>(null);
  const [refuse, setRefuse] = useState(false);
  const minuterie = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  // `sauter` est une fonction fraîche à chaque rendu ; la lire dans une ref
  // évite de relancer le décompte à chaque image du lecteur.
  const sauterRef = useRef(sauter);
  sauterRef.current = sauter;

  useEffect(() => {
    setRefuse(false);
  }, [cle]);

  useEffect(() => () => clearInterval(minuterie.current), []);

  const annuler = useCallback(() => {
    clearInterval(minuterie.current);
    setRefuse(true);
    setCompte(null);
  }, []);

  useEffect(() => {
    if (!actif || !visible || refuse) {
      clearInterval(minuterie.current);
      setCompte(null);
      return;
    }
    setCompte(DEPART_SAUT_INTRO);
    minuterie.current = setInterval(() => {
      setCompte((precedent) => {
        if (precedent === null || precedent <= 1) {
          clearInterval(minuterie.current);
          sauterRef.current();
          return null;
        }
        return precedent - 1;
      });
    }, 1000);
    return () => clearInterval(minuterie.current);
  }, [actif, visible, refuse, cle]);

  return { compte, annuler };
}
