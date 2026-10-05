import type { MutableRefObject } from "react";
import type { TouchMode } from "@tentacle-tv/tv-core";

/** Le sens d'un déplacement et le profil des flèches vivent dans tv-core
 *  (`player/arrowHold.ts`) ; `scrubInput.ts` en donne les valeurs, lues dans
 *  les traits de la télécommande (`scrubInputProfileOf`). */
export type { ScrubDir, ScrubInputProfile } from "@tentacle-tv/tv-core";

/**
 * Contrat d'entrée du défilement au pavé tactile — IDENTIQUE sur les deux
 * plateformes. Le COMPORTEMENT (scrub, seek, annulation) reste dans le cerveau
 * (tv-core `playerControls.ts`) ; ces callbacks ne font que le DÉCLENCHER. Android TV
 * n'a pas de pavé → implémentation no-op. tvOS les alimente depuis le pan de
 * la Siri Remote (useScrubGestures.ios.ts), en manipulation directe.
 */
export interface ScrubGestureHandlers {
  /** Le pavé défile : partout où la vidéo est le sujet (pas dans un panneau). */
  enabled: boolean;
  /** Le régime du geste, lu quand le doigt se pose : défilement déjà ouvert,
   *  habillage affiché, habillage caché — ce dernier n'engage
   *  qu'après un contact tenu —, ou pavé tenu par la pilule de saut, qui
   *  n'engage jamais (`scrubTouchTuning.ts`). */
  readTouchMode: () => TouchMode;
  /** L'heure du dernier appui : un contact qui en voit un est un clic. */
  readLastPressAt: () => number;
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
