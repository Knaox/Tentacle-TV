/**
 * Octave (mobile) — la MESURE du démarrage en Octave : à la première image de
 * la première page d'Octave (après son rendu, `requestAnimationFrame`), une
 * ligne de journal donne la chronologie du JavaScript (`bootTimeline` : stockage
 * relu, polices, app prête, coquille, cache rendu, première page), en ms depuis
 * le début du JavaScript. Le banc la relève (`[octave-boot]`). Une fois, et
 * seulement sur un lancement en Octave.
 */

import { bootTimelineMarks, markBoot } from "@/bootIntro/bootTimeline";
import { octaveLaunch } from "./octaveLaunch";

let reported = false;

export function reportOctaveFirstPage(path: string): void {
  if (reported || !octaveLaunch().inOctave) return;
  reported = true;
  requestAnimationFrame(() => {
    markBoot("octaveFirstPage");
    const marks = bootTimelineMarks().map((mark) => `${mark.name}=${mark.atMs}ms`).join(" ");
    console.info(`[octave-boot] ${path} ${marks}`);
  });
}
