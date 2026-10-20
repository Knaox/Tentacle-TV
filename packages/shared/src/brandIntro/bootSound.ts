/**
 * Le « ta-dum » de l'ouverture, calé à l'image. Le natif lit le FICHIER dérivé
 * de la partition (`INTRO_SCORE`) : il
 * commence par la vague, un peu avant le « ta ». La règle dit à quel instant
 * de la chorégraphie le fichier doit partir, et quand le demander.
 */
import { INTRO_HOLD_AT } from "./introHold";
import { INTRO_SOUND_TA_OFFSET_S } from "./introScore";
import { INTRO_TIMING } from "./introTimeline";

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

/** Le temps de traverser le pont et d'être posé dans le flux de sortie, en plus de l'avance de la sortie. */
export const BOOT_SOUND_BRIDGE_MARGIN_MS = 80;

/** Au-delà, une sortie qui se dit en avance se trompe (l'émulateur dérive) : on s'arrête là. */
export const BOOT_SOUND_MAX_OUTPUT_LEAD_MS = 600;

export interface BootSoundLeads {
  /** L'instant de la chorégraphie où l'horloge de l'image demande le son (sans attente). */
  requestAt: number;
  /** Après l'attente, le délai entre la décision et la reprise de l'image. */
  releaseDelayMs: number;
}

/**
 * Les avances du son d'après celle de la SORTIE de l'appareil (ms : ce que le
 * flux natif a déjà écrit au-delà de ce qui sort ; Android TV la mesure, la
 * Shield ≈ 360 ms ; null : rien de mesuré, l'Apple TV). Un son demandé moins
 * tôt que ce que la sortie a déjà en file perdrait son début — la vague, puis
 * le « ta » —, le natif sautant ce qui est passé pour rester calé à l'image.
 * Sans mesure, les valeurs d'avant (`BOOT_SOUND_REQUEST_AT`,
 * `BOOT_INTRO_RELEASE_DELAY_MS`).
 */
export function bootSoundLeads(outputLeadMs: number | null): BootSoundLeads {
  const lead = Math.min(Math.max(outputLeadMs ?? 0, 0), BOOT_SOUND_MAX_OUTPUT_LEAD_MS);
  const needed = outputLeadMs === null ? 0 : lead + BOOT_SOUND_BRIDGE_MARGIN_MS;
  return {
    requestAt: Math.min(BOOT_SOUND_REQUEST_AT, BOOT_SOUND_FILE_AT - needed),
    // Après l'attente, le fichier part `releaseDelay + (FILE_AT - HOLD_AT)` après la décision.
    releaseDelayMs: Math.max(BOOT_INTRO_RELEASE_DELAY_MS, needed - (BOOT_SOUND_FILE_AT - INTRO_HOLD_AT)),
  };
}
