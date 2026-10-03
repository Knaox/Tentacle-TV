import type { MutableRefObject } from "react";
import type { TouchMode } from "@tentacle-tv/tv-core";

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
 * Contrat d'entrée du défilement au pavé tactile — IDENTIQUE sur les deux
 * plateformes. Le COMPORTEMENT (scrub, seek, annulation) reste dans le cerveau
 * (useTVPlayerControls) ; ces callbacks ne font que le DÉCLENCHER. Android TV
 * n'a pas de pavé → implémentation no-op. tvOS les alimente depuis le pan de
 * la Siri Remote (useScrubGestures.ios.ts), en manipulation directe.
 */
export interface ScrubGestureHandlers {
  /** Le pavé défile : partout où la vidéo est le sujet (pas dans un panneau). */
  enabled: boolean;
  /** Le régime du geste, lu quand le doigt se pose : défilement déjà ouvert,
   *  habillage affiché, habillage caché — ce dernier n'engage
   *  qu'après un contact tenu (`scrubTouchTuning.ts`). */
  readTouchMode: () => TouchMode;
  /** Le doigt se pose (ou repart après un silence) : en défilement, le
   *  décompte attend qu'il s'arrête. */
  onTouchStart: () => void;
  /** Le glisser franchit sa zone morte → entrer en défilement. Idempotent côté
   *  cerveau : ne réinitialise PAS la position si déjà ouvert — un nouveau
   *  glisser reprend d'où le curseur en est. */
  onStartScrub: () => void;
  /** Le doigt emporte le curseur : delta signé, en secondes de vidéo. */
  onNudgeScrub: (deltaSeconds: number) => void;
  /** Le doigt se lève ou s'immobilise (le défilement reste ouvert : OK
   *  valide, Retour annule, le décompte dit la suite). */
  onEndScrub: () => void;
  /** Simple toucher, sans glisser → réveiller l'habillage (en défilement :
   *  un geste, le décompte repart). */
  onWake: () => void;
  /** Durée de la vidéo (s) : tant qu'elle est inconnue, rien ne défile. */
  durationRef: MutableRefObject<number>;
}
