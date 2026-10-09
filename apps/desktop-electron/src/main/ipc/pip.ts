/**
 * Le PiP, côté commandes : la page ANNONCE la fenêtre qu'elle va ouvrir
 * (`pip_open`), en change le mode (`pip_mode`) ou la taille (`pip_resize`).
 * L'ouverture et la fermeture, elles, sont les siennes (`window.open`,
 * `close()`) — voir `pip/pipWindow.ts`.
 *
 * Enregistrées là où le PiP marche SEULEMENT — Wayland avec la colle KWin, la
 * seule voie pour coller la vidéo à une petite fenêtre : les capacités
 * annoncées à la page valent porte, le bouton « Réduire » disparaît ailleurs.
 */

import { z } from "zod";
import { linuxMontage, linuxWindowing } from "../linux/session";
import { armPip, resizePip, setPipMode } from "../pip/pipWindow";
import { CommandRegistry } from "./registry";

const SIZE = z.number().int().min(64).max(8192);
const MODE = z.enum(["floating", "docked"]);
const OPEN = z.object({ mode: MODE, width: SIZE, height: SIZE });
const SWITCH = z.object({ mode: MODE, width: SIZE.optional(), height: SIZE.optional() });
const RESIZE = z.object({ width: SIZE, height: SIZE });

/** Le PiP est-il possible dans ce montage ? */
export function pipSupported(): boolean {
  return process.platform === "linux" && linuxMontage() === "wayland" && linuxWindowing() === "libre";
}

export function registerPipCommands(registry: CommandRegistry): void {
  if (!pipSupported()) return;
  registry
    .add("pip_open", {
      schema: OPEN,
      run: ({ mode, width, height }) => {
        armPip(mode, width, height);
        return true;
      },
    })
    .add("pip_mode", {
      schema: SWITCH,
      run: ({ mode, width, height }) => setPipMode(mode, width, height),
    })
    .add("pip_resize", {
      schema: RESIZE,
      run: ({ width, height }) => resizePip(width, height),
    });
}
