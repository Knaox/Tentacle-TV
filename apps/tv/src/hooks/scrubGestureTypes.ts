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
  /** Franchissement de la dead-zone → entrer en scrub. Idempotent côté cerveau
   *  (garde sur startScrubbing) : ne réinitialise PAS la position si déjà ouvert
   *  → reprise propre après un lever/reposer de doigt (modèle shuttle). */
  onStartScrub: () => void;
  /** Loop d'avance CONTINUE : déplace la position fantôme d'un delta signé
   *  (secondes vidéo). La vitesse est pilotée par la translation du doigt. */
  onNudgeScrub: (deltaSeconds: number) => void;
  /** Badge de vitesse façon DVD (« ▶▶ 4x » / « ◀◀ 2x ») ou null pour masquer. */
  onSpeedLabel: (label: string | null) => void;
  /** Fin du geste → stopper la vitesse (le scrub reste ouvert : OK valide,
   *  BACK annule, comme au relâchement d'un maintien Android). */
  onEndScrub: () => void;
  /** Effleurement léger (pas de scrub) → réveiller l'OSD, parité appui ←/→. */
  onWake: () => void;
}
