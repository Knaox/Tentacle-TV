import AsyncStorage from "@react-native-async-storage/async-storage";
import { formatIntroFrameReport, type IntroFrameReport } from "@tentacle-tv/shared/brandIntro";

/**
 * Le bilan des images de la dernière ouverture, pour le banc (exigence de
 * Damien, 21/10 : prouvée fluide par la mesure). Écrit sur le disque de
 * l'appareil — lisible en Release, où le journal de la console se tait —
 * dans le stockage d'AsyncStorage du conteneur de l'app, et dans le journal
 * de Metro en développement. Clé de diagnostic, jamais lue par l'app.
 */
export const BOOT_INTRO_FRAMES_KEY = "tentacle_debug_boot_intro_frames";

/** Écrit après l'arrivée, hors de toute image de l'ouverture. */
const WRITE_DELAY_MS = 1_500;

export function recordBootIntroFrames(report: IntroFrameReport, viewport: { width: number; height: number }): void {
  if (__DEV__) console.log(formatIntroFrameReport(report));
  setTimeout(() => {
    const entry = { at: new Date().toISOString(), viewport, line: formatIntroFrameReport(report), report };
    AsyncStorage.setItem(BOOT_INTRO_FRAMES_KEY, JSON.stringify(entry)).catch(() => {});
  }, WRITE_DELAY_MS);
}
