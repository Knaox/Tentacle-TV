/**
 * La CHRONOLOGIE du démarrage du mobile, pour le banc de fluidité de
 * l'ouverture : chaque étape du JavaScript (stockage relu, polices, app prête,
 * premier écran…) à l'heure murale, à côté des trous d'image que l'horloge de
 * l'ouverture relève sur le fil d'interface (`stallLog`). Le bilan
 * (`bootIntroFrames.ts`) met les deux sur la même échelle : celle du
 * chargement de ce module (le tout début du JavaScript). Diagnostic seul :
 * quelques nombres, aucun effet sur l'app.
 */

const origin = Date.now();
const marks: { name: string; atMs: number }[] = [];
const seen = new Set<string>();

/** Une étape, une fois (la première) : l'heure depuis le début du JavaScript. */
export function markBoot(name: string): void {
  if (seen.has(name)) return;
  seen.add(name);
  marks.push({ name, atMs: Date.now() - origin });
}

export const bootTimelineOrigin = (): number => origin;
export const bootTimelineMarks = (): readonly { name: string; atMs: number }[] => marks;
