import type { MutableRefObject } from "react";

export type ScrubDir = "forward" | "backward";

/**
 * Les flèches du lecteur, telles que la PLATEFORME les émet — la couture du
 * défilement (`scrubInput.ts` : Android TV ; `scrubInput.ios.ts` : Apple TV).
 * Le cerveau (`useScrubController`, `useScrubHoldMotor`) les lit sans jamais
 * nommer la plateforme : le geste est le même partout — un appui SAUTE, un
 * maintien DÉFILE —, seule la façon de les reconnaître change.
 */
export interface ScrubInputProfile {
  /** Un appui simple ne se tranche qu'au relâchement : son début peut encore
   *  ouvrir un maintien. Sinon, l'événement reçu EST l'appui (déjà tranché). */
  tapOnRelease: boolean;
  /** Le maintien se reconnaît au key-down sans key-up (signal natif peu fiable). */
  holdFromKeyDown: boolean;
  /** Ce qu'on attend encore après le signal d'appui long natif avant d'engager. */
  holdArmMs: number;
  /** La fin du maintien est ANNONCÉE (relâchement de l'appui long) : rien ne
   *  répète entre le début et la fin. Sinon, le silence des répétitions la dit. */
  holdEndAnnounced: boolean;
}

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
  /** Durée de la vidéo (s) → la vitesse de scrub s'y adapte (court = lent, long = rapide). */
  durationRef: MutableRefObject<number>;
}
