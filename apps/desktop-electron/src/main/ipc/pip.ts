/**
 * Le PiP, côté commandes : la page ANNONCE la fenêtre qu'elle va ouvrir
 * (`pip_open`, qui lui rend le cadre à dessiner), en change le mode
 * (`pip_mode`) ou la taille de vidéo (`pip_resize`), et annonce le geste —
 * glisser, tirer un coin — que la colle (Linux) ou la coquille (macOS,
 * `pip/pipShell.ts`) exécute (`pip_gesture`). L'ouverture et la fermeture,
 * elles, sont les siennes (`window.open`, `close()`) — voir `pip/pipWindow.ts`.
 *
 * Enregistrées là où le PiP marche SEULEMENT — les capacités annoncées à la
 * page valent porte, le bouton « Réduire » disparaît ailleurs :
 * - Linux, Wayland avec la colle KWin, qui colle mpv à la fenêtre PiP ;
 * - macOS au montage « fenêtre » (Apple Silicon) : la fenêtre Metal de mpv
 *   change de parent (`video/macosPipParent.ts`). Pas le montage GL d'Intel,
 *   où la vidéo est une vue DANS notre fenêtre — elle ne se déplace pas ;
 * - Windows : la fenêtre fille de mpv change de parent (`video/videoWindow.ts`).
 */

import { z } from "zod";
import { linuxMontage, linuxWindowing } from "../linux/session";
import { PIP_GESTURES } from "../pip/pipCaptions";
import { PIP_FRAME } from "../pip/pipFrame";
import { armPip, resizePip, restorePip, setPipGesture, setPipMode } from "../pip/pipWindow";
import { decideMacosMontage } from "../video/macosMontage";
import { CommandRegistry } from "./registry";

const SIZE = z.number().int().min(64).max(8192);
const MODE = z.enum(["floating", "docked"]);
const OPEN = z.object({ mode: MODE, width: SIZE, height: SIZE });
const SWITCH = z.object({ mode: MODE, width: SIZE.optional(), height: SIZE.optional() });
const RESIZE = z.object({ width: SIZE, height: SIZE });
const COORDINATE = z.number().finite().min(-8192).max(8192);
const GESTURE = z.object({
  gesture: z.enum(PIP_GESTURES).nullable(),
  /** Le point saisi, pour glisser. */
  grab: z.object({ x: COORDINATE, y: COORDINATE }).optional(),
});

/** Le PiP est-il possible dans ce montage ? */
export function pipSupported(): boolean {
  if (process.platform === "darwin") return decideMacosMontage(process.arch, process.env) === "fenetre";
  if (process.platform === "win32") return true;
  return process.platform === "linux" && linuxMontage() === "wayland" && linuxWindowing() === "libre";
}

export function registerPipCommands(registry: CommandRegistry): void {
  if (!pipSupported()) return;
  registry
    .add("pip_open", {
      schema: OPEN,
      run: ({ mode, width, height }) => {
        armPip(mode, width, height);
        return PIP_FRAME;
      },
    })
    .add("pip_mode", {
      schema: SWITCH,
      run: ({ mode, width, height }) => setPipMode(mode, width, height),
    })
    .add("pip_resize", {
      schema: RESIZE,
      run: ({ width, height }) => resizePip(width, height),
    })
    .add("pip_gesture", {
      schema: GESTURE,
      run: ({ gesture, grab }) => setPipGesture(gesture, grab),
    })
    // Rend la main une fois l'image revenue à sa place dans le lecteur.
    .add("pip_restore", {
      schema: z.object({}).passthrough(),
      run: () => restorePip(),
    });
}
