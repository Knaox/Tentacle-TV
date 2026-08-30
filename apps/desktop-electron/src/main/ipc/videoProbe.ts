/**
 * La sonde de surface, branchée à la page et au journal.
 *
 * Séparée de `ipc/video.ts` pour tenir la limite de 300 lignes, et parce que
 * c'est du DIAGNOSTIC : le fichier entier disparaît d'un paquet livré, sans
 * qu'aucune ligne du chemin de lecture n'ait à s'en soucier.
 *
 * ⚠️ macOS et développement seulement. La sonde lance `screencapture` — un
 * exécutable du système — ce qu'un paquet livré n'a aucune raison de faire.
 *
 * ⚠️ `macosProbe.ts` est donc chargé PARESSEUSEMENT, derrière `probeAvailable`.
 * Il remonte à `objc.ts`, qui appelle `koffi.load("/usr/lib/libobjc.A.dylib")`
 * dès l'import : un `import` en tête de fichier ferait tomber le processus
 * principal sur Windows avant la première fenêtre.
 */

import { app } from "electron";
import { z } from "zod";
import type { VideoSurface } from "../video/surface";
import type { CommandRegistry } from "./registry";

const NO_ARGS = z.object({}).passthrough();

/** La surface courante, lue au moment de l'appel — elle change à chaque média. */
export type SurfaceGetter = () => VideoSurface | null;

/** La sonde a-t-elle sa place ici ? */
export function probeAvailable(): boolean {
  return process.platform === "darwin" && !app.isPackaged;
}

export function registerVideoProbe(registry: CommandRegistry, surface: SurfaceGetter): void {
  if (!probeAvailable()) return;
  const { probe } = require("../video/macosProbe") as typeof import("../video/macosProbe");
  registry.add("video_surface_probe", { schema: NO_ARGS, run: () => probe(surface()) });

  // ⚠️ Le headroom EDR à part, et sans rien capturer. Il n'est pas une capacité
  // mais un arbitrage RÉVISABLE : le compositeur le monte par une rampe qui dure
  // plusieurs secondes (mesuré 5,23 → 6,00 → 6,98 → 7,02), et il retombe dès que
  // la fenêtre cesse d'être visible. Le panneau servait la valeur figée au
  // moment de la dernière capture, et affichait donc « 1,00 » pendant toute une
  // lecture parfaitement HDR — on ne pouvait pas prouver le contraire.
  //
  // Deux lectures de `NSScreen` : à ce prix-là, on peut rafraîchir à chaque
  // passe du panneau, là où la sonde complète coûte seize méga-octets de
  // capture et reste sur demande.
  const { readEdr } = require("../video/macosEdr") as typeof import("../video/macosEdr");
  registry.add("video_edr_probe", {
    schema: NO_ARGS,
    run: () => {
      const state = readEdr(surface()?.videoWindow?.() ?? null);
      return { current: state.current, potential: state.potential };
    },
  });
}

/**
 * Délai après le démarrage de la lecture.
 *
 * La plage étendue n'est pas accordée à la première image : le compositeur la
 * consent quand du contenu qui la réclame est réellement affiché. Sonder trop
 * tôt donnerait 1,00 et ferait conclure à tort à l'absence de HDR.
 */
const REPORT_DELAY_MS = 3000;

let scheduled: ReturnType<typeof setTimeout> | null = null;
let already = false;

/**
 * Trace le rapport une fois par lecture, quelques secondes après la première
 * image.
 *
 * Une seule fois : `playback-restart` est émis à chaque seek, et un rapport par
 * saut noierait le journal pour redire la même chose.
 */
export function scheduleReport(surface: SurfaceGetter): void {
  if (!probeAvailable() || already || scheduled !== null) return;
  scheduled = setTimeout(() => {
    scheduled = null;
    already = true;
    const { traceReport } =
      require("../video/macosProbe") as typeof import("../video/macosProbe");
    void traceReport(surface());
  }, REPORT_DELAY_MS);
}

/** Remet le rapport à neuf — à l'ouverture d'une instance mpv. */
export function resetReport(): void {
  if (scheduled !== null) clearTimeout(scheduled);
  scheduled = null;
  already = false;
}
