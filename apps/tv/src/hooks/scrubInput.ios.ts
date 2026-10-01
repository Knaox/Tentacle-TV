import type { ScrubInputProfile } from "./scrubGestureTypes";

/**
 * Les flèches du lecteur sur APPLE TV (la variante Android TV : `scrubInput.ts`).
 *
 * tvOS tranche lui-même entre appui et maintien : un appui simple n'émet QUE
 * son relâchement (`left`), l'événement reçu EST le geste ; un maintien émet
 * son début une fois reconnu, à une demi-seconde (`longLeft`), puis sa fin au
 * relâcher — et rien entre les deux (mesuré au simulateur). Le défilement part
 * donc dès le début de l'appui long, comme l'avance rapide du lecteur d'Apple,
 * et s'arrête à sa fin annoncée.
 */
export const SCRUB_INPUT: ScrubInputProfile = {
  tapOnRelease: false,
  holdFromKeyDown: false,
  holdArmMs: 0,
  holdEndAnnounced: true,
};
