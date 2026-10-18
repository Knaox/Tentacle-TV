/**
 * Le « ta-dum » de l'ouverture, calé à l'image. Le natif lit le FICHIER dérivé
 * de la partition (`@tentacle-tv/shared/brandIntro`, `INTRO_SCORE`) : il
 * commence par la vague, un peu avant le « ta ». La règle dit à quel instant
 * de la chorégraphie le fichier doit partir, et quand le demander.
 */
import { INTRO_HOLD_AT, INTRO_SOUND_TA_OFFSET_S, INTRO_TIMING } from "@tentacle-tv/shared/brandIntro";

/** L'instant de la chorégraphie où le fichier part : le « ta » tombe sur l'appui. */
export const BOOT_SOUND_FILE_AT = INTRO_TIMING.press.at - INTRO_SOUND_TA_OFFSET_S * 1000;

/**
 * L'horloge de l'image demande le son d'autant plus tôt : le temps qu'il
 * traverse le pont et que le lecteur natif le programme à l'instant exact.
 */
export const BOOT_SOUND_SCHEDULE_LEAD_MS = 260;

/**
 * Après l'attente, l'image reprend un peu plus tard que la décision : de quoi
 * programmer le son avant l'appui (les boucles du scintillement s'éteignent
 * pendant ce temps).
 */
export const BOOT_INTRO_RELEASE_DELAY_MS = 120;

/**
 * L'heure (horloge des images, ms) à laquelle lancer le fichier, vue depuis
 * une image datée `frameAt` qui montre l'instant `sceneAt` de la chorégraphie.
 */
export function bootSoundStartAt(frameAt: number, sceneAt: number): number {
  return frameAt + (BOOT_SOUND_FILE_AT - sceneAt);
}

/** L'instant où l'horloge de l'image demande le son (sans attente). */
export const BOOT_SOUND_REQUEST_AT = Math.min(INTRO_HOLD_AT, BOOT_SOUND_FILE_AT - BOOT_SOUND_SCHEDULE_LEAD_MS);
