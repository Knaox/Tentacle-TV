import { useCallback, useEffect, useRef, useState } from "react";
import { usePreventRemove } from "@react-navigation/native";
import type { PlayerOverlay } from "@tentacle-tv/shared";

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
 * tant que scrub / surface « épisode suivant » / grâce est actif, le pop natif est annulé et
 * `routeBack` consomme l'appui. Android : le BackHandler LIFO consomme l'appui AVANT la
 * navigation → cette prévention n'y est jamais atteinte par Retour (inerte).
 *
 * `routeBack()` est AUSSI la première étape des chemins Retour JS (BackHandler Android,
 * bouton Retour de l'OSD) → une seule source de vérité pour « que fait Retour ».
 *
 * Le bouton de saut AUTOMATIQUE y est entré pour cette raison exactement :
 * Android le masquait au Retour, Apple TV quittait la lecture. Le lecteur doit
 * se comporter pareil des deux côtés, et la seule voie qui marche sur tvOS
 * passe par ici.
 */
export function useTVPlayerBack(args: {
  /** État de scrub RENDU (la prévention native se base sur le dernier rendu). */
  scrubbing: boolean;
  cancelScrub: () => void;
  /**
   * Une SURFACE « épisode suivant » est-elle montée ? — état rendu + miroir
   * synchrone (lecture au sein du dispatch).
   *
   * La surface et non le décompte : celui-ci peut être éteint dans les réglages
   * alors que la carte ou l'affiche de fin sont bien là. S'en remettre au
   * décompte ferait quitter le lecteur sur un Retour qui devait seulement
   * fermer l'affiche.
   */
  surfaceActive: boolean;
  /**
   * Un bouton de saut AUTOMATIQUE est-il affiché ? — état rendu.
   *
   * Sur Android, le Retour le masque depuis toujours (`useTVRemote`). Sur
   * Apple TV, ce code est mort — le Menu physique n'atteint pas le JS — et le
   * Retour QUITTAIT donc la lecture au moment précis où l'utilisateur voulait
   * seulement garder son intro. Le geste doit être le même des deux côtés.
   *
   * Automatique seulement : un bouton qu'il faut demander n'est qu'une
   * proposition, et Retour doit y rester le Retour.
   */
  skipRefusable: boolean;
  /** Met en sourdine le passage courant — le geste du bouton « Masquer ». */
  dismissSegment: () => void;
  /** L'overlay COURANT en miroir synchrone (`usePlaybackOverlay.overlayRef`) :
   *  une carte « à suivre » ou une affiche de fin est une surface montée. */
  surfaceRef: { readonly current: PlayerOverlay };
  /** Ferme l'overlay auto-play ; renvoie true si un départ (navigation) est engagé —
   *  dans ce cas la grâce n'est PAS armée (elle bloquerait le dispatch différé). */
  dismissAutoPlay: () => boolean;
}) {
  const {
    scrubbing, cancelScrub, surfaceActive, skipRefusable, dismissSegment,
    surfaceRef, dismissAutoPlay,
  } = args;

  const scrubbingRef = useRef(scrubbing);
  scrubbingRef.current = scrubbing;
  const cancelScrubRef = useRef(cancelScrub);
  cancelScrubRef.current = cancelScrub;
  const dismissRef = useRef(dismissAutoPlay);
  dismissRef.current = dismissAutoPlay;
  const dismissSegmentRef = useRef(dismissSegment);
  dismissSegmentRef.current = dismissSegment;

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
    if (surfaceRef.current.kind === "nextCard") {
      const navigating = dismissRef.current();
      if (!navigating) armGrace();   // navigation engagée → la grâce bloquerait son dispatch
      return true;
    }
    // Un passage qui part tout seul : Retour le garde, comme sur Android.
    // Déjà en sourdine (`dismissible: false`), il n'y a plus rien à refuser —
    // le bouton n'est là que le temps de l'habillage, et Retour reprend son
    // office ordinaire.
    const surface = surfaceRef.current;
    if (surface.kind === "skip" && surface.auto && surface.dismissible) {
      dismissSegmentRef.current();
      armGrace();
      return true;
    }
    return false;
  }, [armGrace, surfaceRef]);

  usePreventRemove(
    scrubbing || surfaceActive || skipRefusable || graceActive,
    () => { routeBack(); },
  );

  return { routeBack };
}
