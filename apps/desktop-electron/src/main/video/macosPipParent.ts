/**
 * Le PiP sur macOS, vu de la surface : sous quelle fenêtre poser celle de mpv.
 *
 * Hors PiP, la fenêtre de mpv est fille de la fenêtre principale, sous la page
 * (`macosChildWindow.ts`). Quand la page ouvre la fenêtre PiP
 * (`pip/pipWindow.ts`), la fenêtre de mpv CHANGE DE PARENT : retirée de la
 * principale, attachée sous la fenêtre PiP, calée dans son cadre moins le
 * liseré et l'ombre (`pip/pipFrame.ts`). À la fermeture, le geste inverse.
 *
 * mpv n'en sait rien : ni nouvelle instance, ni nouvelle sortie vidéo, ni
 * nouvelle couche Metal. C'est ce qui garde la lecture ET le HDR — l'espace
 * colorimétrique de la couche est fixé à sa naissance (`macosEdr.ts`), une
 * nouvelle fenêtre le perdrait.
 *
 * Séparé de `macosSurface.ts`, qui suit la lecture : savoir où est le PiP et
 * en suivre la géométrie est un métier à part, que Linux ne partage pas (la
 * colle KWin y fait tout).
 */

import type { BrowserWindow } from "electron";
import { currentPipWindow, onPipRestacked, onPipWindowChange } from "../pip/pipHost";
import { PIP_INSET } from "../pip/pipFrame";
import { fromHandle, msg, type Rect } from "./objc";

interface PipParent {
  window: BrowserWindow;
  /** Sa `NSWindow`. */
  ns: unknown;
}

/**
 * Le PiP courant, tenu pour une surface : `moved` est appelé quand la fenêtre
 * de mpv doit changer de parent (`null` : la fenêtre principale), `follow`
 * quand le PiP bouge ou change de taille.
 */
export class MacosPipParent {
  private pip: PipParent | null = null;
  private unsubscribe: (() => void) | null = null;
  private unsubscribeRestack: (() => void) | null = null;

  constructor(
    private readonly moved: (from: unknown, to: unknown) => void,
    private readonly follow: () => void,
  ) {}

  /** Commence à suivre le PiP — déjà ouvert, peut-être (épisode suivant). */
  start(): void {
    if (this.unsubscribe !== null) return;
    this.unsubscribe = onPipWindowChange((window) => this.adopt(window));
    this.unsubscribeRestack = onPipRestacked(this.follow);
    this.adopt(currentPipWindow());
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.unsubscribeRestack?.();
    this.unsubscribeRestack = null;
    this.release();
    this.pip = null;
  }

  /** La `NSWindow` du PiP, ou `null` hors PiP. */
  get ns(): unknown {
    return this.pip?.ns ?? null;
  }

  /** Le rectangle de la vidéo dans le PiP, en coordonnées AppKit — `null` hors PiP. */
  target(): Rect | null {
    if (this.pip === null || this.pip.window.isDestroyed()) return null;
    const frame: Rect = msg.rect(this.pip.ns, "frame");
    return {
      x: frame.x + PIP_INSET,
      y: frame.y + PIP_INSET,
      width: Math.max(1, frame.width - 2 * PIP_INSET),
      height: Math.max(1, frame.height - 2 * PIP_INSET),
    };
  }

  /** Le niveau du PiP — celui de sa fille, que `addChildWindow:` aligne. */
  level(): number | null {
    if (this.pip === null || this.pip.window.isDestroyed()) return null;
    return msg.int(this.pip.ns, "level");
  }

  private adopt(window: BrowserWindow | null): void {
    const from = this.ns;
    this.release();
    this.pip =
      window === null || window.isDestroyed()
        ? null
        : { window, ns: msg.get(fromHandle(window.getNativeWindowHandle()), "window") };
    if (this.pip !== null) {
      this.pip.window.on("resize", this.follow);
      this.pip.window.on("move", this.follow);
    }
    if (from !== this.ns) this.moved(from, this.ns);
  }

  private release(): void {
    const window = this.pip?.window;
    if (window === undefined || window.isDestroyed()) return;
    window.off("resize", this.follow);
    window.off("move", this.follow);
  }
}
