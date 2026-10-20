import AsyncStorage from "@react-native-async-storage/async-storage";
import type { IntroWallTrace } from "@tentacle-tv/brand-intro-native";
import { formatIntroFrameReport, type IntroFrameReport } from "@tentacle-tv/shared/brandIntro";
import { bootTimelineMarks, bootTimelineOrigin } from "./bootTimeline";

/**
 * Le bilan des images de la dernière ouverture, pour le banc (exigence de
 * Damien, 21/10 : prouvée fluide par la mesure). Écrit sur le disque de
 * l'appareil — lisible en Release, où le journal de la console se tait —
 * dans le stockage d'AsyncStorage du conteneur de l'app, et dans le journal
 * de Metro en développement. Avec la CHRONOLOGIE : les étapes du démarrage
 * (`markBoot`) et les trous d'image, à la même échelle (ms depuis le début du
 * JavaScript) — ce qui fige le fil d'interface se lit en face. Clé de
 * diagnostic, jamais lue par l'app.
 */
export const BOOT_INTRO_FRAMES_KEY = "tentacle_debug_boot_intro_frames";

/** Écrit après l'arrivée, hors de toute image de l'ouverture. */
const WRITE_DELAY_MS = 1_500;

function timelineOf(trace: IntroWallTrace): string[] {
  const origin = bootTimelineOrigin();
  const at = (wall: number) => (wall > 0 ? Math.round(wall - origin) : null);
  const entries: { atMs: number; label: string }[] = bootTimelineMarks().map((mark) => ({ atMs: mark.atMs, label: mark.name }));
  const clock = { "intro:first-frame": trace.firstFrame, "intro:start": trace.start, "intro:dive": trace.dive, "intro:done": trace.done };
  for (const [label, wall] of Object.entries(clock)) {
    const atMs = at(wall);
    if (atMs !== null) entries.push({ atMs, label });
  }
  for (let index = 0; index + 1 < trace.stalls.length; index += 2) {
    const atMs = at(trace.stalls[index] as number);
    if (atMs !== null) entries.push({ atMs, label: `TROU ${Math.round(trace.stalls[index + 1] as number)} ms` });
  }
  return entries.sort((a, b) => a.atMs - b.atMs).map((entry) => `${entry.atMs} ${entry.label}`);
}

export function recordBootIntroFrames(report: IntroFrameReport, trace: IntroWallTrace, viewport: { width: number; height: number }): void {
  const line = formatIntroFrameReport(report);
  const timeline = timelineOf(trace);
  if (__DEV__) console.log(`${line}\n${timeline.join("\n")}`);
  setTimeout(() => {
    const entry = { at: new Date().toISOString(), viewport, line, timeline, report };
    AsyncStorage.setItem(BOOT_INTRO_FRAMES_KEY, JSON.stringify(entry)).catch(() => {});
  }, WRITE_DELAY_MS);
}
