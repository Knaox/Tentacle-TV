/**
 * Le cadre du PiP posé par la coquille, et la TAILLE qu'il doit garder.
 *
 * Retour de Damien (Windows) : passer Tentacle d'un écran à l'autre changeait
 * la taille du PiP ancré. La coquille relisait la taille de la fenêtre pour la
 * replacer ; or `setBounds` vers un écran d'une autre échelle convertit les
 * points en pixels avec l'échelle de l'écran de DÉPART, et la fenêtre arrive
 * plus grande ou plus petite — l'erreur se reportait ensuite à chaque
 * déplacement. La taille voulue, en points logiques, vit donc ici : seuls la
 * page (molette, mode) et la main (coin tiré, bords du système) la changent.
 * Sous Windows, une pose qui n'a pas donné la taille demandée est refaite une
 * fois — la fenêtre est alors sur le bon écran, à la bonne échelle.
 */

import type { BrowserWindow } from "electron";
import type { Box } from "./pipPlacement";

export function sameBox(a: Box, b: Box): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

export class PipBounds {
  /** La taille voulue de la fenêtre PiP, en points logiques. */
  size: { width: number; height: number };

  constructor(private readonly pip: BrowserWindow) {
    const { width, height } = pip.getBounds();
    this.size = { width, height };
  }

  /** Retient la taille que la main ou la page viennent de choisir. */
  remember(size: { width: number; height: number }): void {
    this.size = { width: size.width, height: size.height };
  }

  /** Retient la taille ACTUELLE de la fenêtre — après un geste de la main. */
  rememberCurrent(): void {
    if (!this.pip.isDestroyed()) this.remember(this.pip.getBounds());
  }

  set(box: Box): void {
    if (this.pip.isDestroyed() || sameBox(this.pip.getBounds(), box)) return;
    this.pip.setBounds(box);
    if (process.platform !== "win32") return;
    const got = this.pip.getBounds();
    if (got.width !== box.width || got.height !== box.height) this.pip.setBounds(box);
  }
}
