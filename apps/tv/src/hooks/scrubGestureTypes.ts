export type ScrubDir = "forward" | "backward";

/**
 * Contrat d'entrée du scrub gestuel — IDENTIQUE sur les deux plateformes.
 * Le COMPORTEMENT (scrub, paliers, seek) reste 100 % dans useTVPlayerControls ;
 * ces callbacks ne font que le DÉCLENCHER. Android n'en a pas besoin (events
 * télécommande natifs longLeft/rewind) → implémentation no-op. tvOS les alimente
 * depuis les gestes pan de la Siri Remote (useScrubGestures.ios.ts).
 */
export interface ScrubGestureHandlers {
  /** Pan actif uniquement quand on PEUT scrubber (OSD caché ou déjà en scrub). */
  enabled: boolean;
  /** Début d'un geste horizontal franc → entrer en scrub dans cette direction. */
  onStartScrub: (dir: ScrubDir) => void;
  /** Progression du geste → un pas de scrub (l'accélération par paliers du
   *  cerveau s'applique automatiquement via le temps de maintien). */
  onStepScrub: (dir: ScrubDir) => void;
  /** Fin du geste → stopper l'accélération (le scrub reste ouvert : OK valide,
   *  BACK annule, comme au relâchement d'un maintien Android). */
  onEndScrub: () => void;
  /** Effleurement léger (pas de scrub) → réveiller l'OSD, parité appui ←/→. */
  onWake: () => void;
}
