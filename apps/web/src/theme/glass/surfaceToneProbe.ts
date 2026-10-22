/**
 * La MESURE du ton tenu d'une grande surface (`useSurfaceTone`), pure par ses
 * dépendances : la couronne (`surfaceTone.ts`) est confiée à l'ordonnanceur
 * des tons, le lot revenu donne UN ton, puis tout est désabonné.
 *
 * Quand se mesure-t-on ? À l'ouverture, puis seulement quand ce qui fait le
 * ton change sous la surface ouverte (`surfaceToneEpoch`) : le THÈME (Clair,
 * Sombre, Auto, `prefers-color-scheme`, donc l'apparence de macOS relayée par
 * Electron) et le MATÉRIAU du système (« Réduire la transparence »,
 * « Contraste accru »). Défaut 25 de l'audit lg2 : une barre latérale mesurée
 * claire restait une plaque claire sur la page devenue noire. Jamais au
 * défilement, au survol ni à la minuterie : le ton reste TENU.
 */

import type { ResolvedScheme } from "@tentacle-tv/theme";

import type { GlassMaterial } from "./accessibility";
import type { BackdropTone, ToneRect, ToneScheduler } from "./backdropTone";
import { heldSurfaceTone, PROBE_SIDES, type ProbeSide } from "./surfaceTone";

/** Sans réponse de la coquille passé ce délai : le ton supposé reste. */
export const SURFACE_TONE_GIVE_UP_MS = 1500;
/**
 * Après un changement de thème, la page se repeint (jetons, fondus de
 * couleur) : la capture attend, sinon elle verrait la page d'AVANT.
 */
export const SURFACE_TONE_REMEASURE_DELAY_MS = 250;

/** Ce qui, en changeant, rend le ton tenu caduc. */
export function surfaceToneEpoch(scheme: ResolvedScheme, material: GlassMaterial): string {
  return `${scheme}|${material}`;
}

export interface SurfaceToneProbeDeps {
  scheduler: Pick<ToneScheduler, "observe" | "unwatch">;
  /** La bande d'un côté de la couronne, lue au moment de la mesure. */
  rectOf: (side: ProbeSide) => ToneRect | null;
  setTimer: (callback: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
}

/**
 * Lance UNE mesure (après `delayMs`) et rend le ton par `onTone` ; rien si la
 * coquille ne répond pas. Rend de quoi l'annuler (démontage, nouvelle mesure).
 */
export function startSurfaceToneProbe(
  id: string,
  assumed: BackdropTone,
  deps: SurfaceToneProbeDeps,
  onTone: (tone: BackdropTone) => void,
  delayMs = 0,
): () => void {
  const ids = PROBE_SIDES.map((side) => `${id}:${side}`);
  const luminances: number[] = [];
  const timers = new Set<unknown>();
  let done = false;
  const later = (callback: () => void, ms: number): void => {
    const handle = deps.setTimer(() => {
      timers.delete(handle);
      callback();
    }, ms);
    timers.add(handle);
  };
  const stop = (): void => {
    done = true;
    for (const handle of timers) deps.clearTimer(handle);
    timers.clear();
    for (const probe of ids) deps.scheduler.unwatch(probe);
  };
  const finish = (): void => {
    if (done) return;
    stop();
    if (luminances.length > 0) onTone(heldSurfaceTone(assumed, luminances));
  };
  let settling = false;
  // Tout le lot de la couronne revient d'un coup : on conclut juste après.
  const collect = (value: number): void => {
    if (done) return;
    luminances.push(value);
    if (settling) return;
    settling = true;
    later(finish, 0);
  };
  const observe = (): void => {
    if (done) return;
    PROBE_SIDES.forEach((side, index) => deps.scheduler.observe(ids[index]!, () => deps.rectOf(side), collect));
    later(finish, SURFACE_TONE_GIVE_UP_MS);
  };
  if (delayMs > 0) later(observe, delayMs);
  else observe();
  return stop;
}
