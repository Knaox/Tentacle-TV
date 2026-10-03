/**
 * Les GARDES des appuis du lecteur : les fenêtres où un appui n'est pas ce
 * qu'il semble. Un appui sur OK part à la fois en événement global et en
 * `onPress` de l'élément focalisé ; certaines télécommandes intercalent des
 * échos pendant le maintien d'une touche média ; le pouce frôle le pavé en
 * cliquant. Chiffres repris tels quels du lecteur d'`apps/tv`.
 */

/** Un OK émet l'événement global ET le press du bouton focalisé (même
 *  relâchement, ordre indéterminé) : pendant cette fenêtre après la fin d'un
 *  défilement — ou après son ouverture par un bouton —, le jumeau est avalé. */
export const SCRUB_TWIN_PRESS_MS = 400;

/** Pendant le MAINTIEN d'une touche média (avance, recul), certaines
 *  télécommandes intercalent des échos select / lecture-pause : ils
 *  validaient le défilement en plein maintien. Un vrai OK de validation
 *  n'arrive qu'après le relâchement, donc au-delà. */
export const MEDIA_KEY_ECHO_MS = 300;

/** Un toucher du pavé qui suit un appui de si près l'ACCOMPAGNE (le pouce
 *  frôle la surface en cliquant le bord) : ce n'est pas un geste. */
export const TOUCH_AFTER_PRESS_MS = 600;

/** Un tic de maintien actif — ou arrêté depuis moins que cela : les appuis
 *  directionnels concomitants sont des doublons parasites du maintien. */
export const HOLD_TICK_TAIL_MS = 400;

/** OK ou Lecture/Pause, défilement ouvert : valident-ils ? Non pour l'écho
 *  d'une touche média, ni pour le jumeau d'une entrée par un bouton. */
export function scrubConfirmable(now: number, marks: { lastMediaKeyAt: number; scrubStartedAt: number }): boolean {
  if (now - marks.lastMediaKeyAt < MEDIA_KEY_ECHO_MS) return false;
  return now - marks.scrubStartedAt >= SCRUB_TWIN_PRESS_MS;
}

/** Un bouton de l'habillage pressé juste après la fin d'un défilement : le
 *  jumeau de l'OK qui l'a fermé — avalé. */
export function isScrubTwinPress(now: number, scrubEndedAt: number): boolean {
  return now - scrubEndedAt < SCRUB_TWIN_PRESS_MS;
}

/** Un toucher du pavé qui accompagne un appui (ou un relâchement) récent. */
export function touchFollowsPress(now: number, lastPressAt: number): boolean {
  return now - lastPressAt < TOUCH_AFTER_PRESS_MS;
}

/** Le maintien tient-il encore les appuis directionnels ? */
export function holdStillTicking(ticking: boolean, now: number, stoppedAt: number): boolean {
  return ticking || now - stoppedAt < HOLD_TICK_TAIL_MS;
}
