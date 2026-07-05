import { useCallback, useEffect, useRef, useState } from "react";
import { usePreventRemove } from "@react-navigation/native";

/** Fenêtre de grâce après chaque consommation d'un Retour : un double-appui (ou un
 *  appui pendant l'animation de fermeture d'un overlay) est AVALÉ au lieu de quitter. */
const BACK_GRACE_MS = 600;

/**
 * Routage du bouton RETOUR du lecteur.
 *
 * tvOS : le bouton Menu/Retour physique n'atteint JAMAIS le JS (`enableTVMenuKey`
 * n'est appelé nulle part — vérifié dans react-native-tvos) : le système POP l'écran
 * nativement. Tous les `useTVRemote({ onBack })` du lecteur sont du code mort pour ce
 * bouton — c'est pour ça qu'un Retour sur l'overlay « épisode suivant » quittait la
 * vidéo. La SEULE interception qui fonctionne est `usePreventRemove` (le mécanisme du
 * panneau épisodes, pop-restore react-native-screens, invisible avec animation:"none") :
 * tant que scrub / compte à rebours / grâce est actif, le pop natif est annulé et
 * `routeBack` consomme l'appui. Android : le BackHandler LIFO consomme l'appui AVANT la
 * navigation → cette prévention n'y est jamais atteinte par Retour (inerte).
 *
 * `routeBack()` est AUSSI la première étape des chemins Retour JS (BackHandler Android,
 * bouton Retour de l'OSD) → une seule source de vérité pour « que fait Retour ».
 */
export function useTVPlayerBack(args: {
  /** État de scrub RENDU (la prévention native se base sur le dernier rendu). */
  scrubbing: boolean;
  cancelScrub: () => void;
  /** Compte à rebours auto-play RENDU + miroir synchrone (lecture au sein du dispatch). */
  countdown: number | null;
  countdownRef: React.MutableRefObject<number | null>;
  /** Ferme l'overlay auto-play ; renvoie true si un départ (navigation) est engagé —
   *  dans ce cas la grâce n'est PAS armée (elle bloquerait le dispatch différé). */
  dismissAutoPlay: () => boolean;
}) {
  const { scrubbing, cancelScrub, countdown, countdownRef, dismissAutoPlay } = args;

  const scrubbingRef = useRef(scrubbing);
  scrubbingRef.current = scrubbing;
  const cancelScrubRef = useRef(cancelScrub);
  cancelScrubRef.current = cancelScrub;
  const dismissRef = useRef(dismissAutoPlay);
  dismissRef.current = dismissAutoPlay;

  const [graceActive, setGraceActive] = useState(false);
  const graceUntilRef = useRef(0);
  const graceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const armGrace = useCallback(() => {
    graceUntilRef.current = Date.now() + BACK_GRACE_MS;
    setGraceActive(true);
    if (graceTimerRef.current) clearTimeout(graceTimerRef.current);
    graceTimerRef.current = setTimeout(() => setGraceActive(false), BACK_GRACE_MS);
  }, []);
  useEffect(() => () => { if (graceTimerRef.current) clearTimeout(graceTimerRef.current); }, []);

  /** Consomme un Retour : true = absorbé (scrub annulé / overlay fermé / grâce),
   *  false = rien à consommer → le caller peut quitter le lecteur. */
  const routeBack = useCallback((): boolean => {
    if (Date.now() < graceUntilRef.current) return true;          // double-appui → avalé
    if (scrubbingRef.current) {
      cancelScrubRef.current();
      armGrace();
      return true;
    }
    if (countdownRef.current !== null) {
      const navigating = dismissRef.current();
      if (!navigating) armGrace();   // navigation engagée → la grâce bloquerait son dispatch
      return true;
    }
    return false;
  }, [armGrace, countdownRef]);

  usePreventRemove(scrubbing || countdown !== null || graceActive, () => { routeBack(); });

  return { routeBack };
}
