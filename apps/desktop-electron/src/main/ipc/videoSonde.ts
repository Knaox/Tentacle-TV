/**
 * La sonde de surface, branchée à la page et au journal.
 *
 * Séparée de `ipc/video.ts` pour tenir la limite de 300 lignes, et parce que
 * c'est du DIAGNOSTIC : le fichier entier disparaît d'un paquet livré, sans
 * qu'aucune ligne du chemin de lecture n'ait à s'en soucier.
 *
 * ⚠️ macOS et développement seulement. La sonde lance `screencapture` — un
 * exécutable du système — ce qu'un paquet livré n'a aucune raison de faire.
 */

import { app } from "electron";
import { z } from "zod";
import { sonder, tracerRapport } from "../video/sondeMacos";
import type { VideoSurface } from "../video/surface";
import type { CommandRegistry } from "./registry";

const NO_ARGS = z.object({}).passthrough();

/** La surface courante, lue au moment de l'appel — elle change à chaque média. */
export type Surface = () => VideoSurface | null;

/** La sonde a-t-elle sa place ici ? */
export function sondeDisponible(): boolean {
  return process.platform === "darwin" && !app.isPackaged;
}

export function registerVideoProbe(registry: CommandRegistry, surface: Surface): void {
  if (!sondeDisponible()) return;
  registry.add("video_surface_probe", { schema: NO_ARGS, run: () => sonder(surface()) });
}

/**
 * Délai après le démarrage de la lecture.
 *
 * La plage étendue n'est pas accordée à la première image : le compositeur la
 * consent quand du contenu qui la réclame est réellement affiché. Sonder trop
 * tôt donnerait 1,00 et ferait conclure à tort à l'absence de HDR.
 */
const DELAI_RAPPORT_MS = 3000;

let planifie: ReturnType<typeof setTimeout> | null = null;
let deja = false;

/**
 * Trace le rapport une fois par lecture, quelques secondes après la première
 * image.
 *
 * Une seule fois : `playback-restart` est émis à chaque seek, et un rapport par
 * saut noierait le journal pour redire la même chose.
 */
export function planifierRapport(surface: Surface): void {
  if (!sondeDisponible() || deja || planifie !== null) return;
  planifie = setTimeout(() => {
    planifie = null;
    deja = true;
    void tracerRapport(surface());
  }, DELAI_RAPPORT_MS);
}

/** Remet le rapport à neuf — à l'ouverture d'une instance mpv. */
export function reinitialiserRapport(): void {
  if (planifie !== null) clearTimeout(planifie);
  planifie = null;
  deja = false;
}
