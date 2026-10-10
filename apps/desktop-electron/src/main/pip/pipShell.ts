/**
 * Le PiP mené par la coquille — macOS et Windows.
 *
 * Sous Linux, c'est la colle KWin qui place la fenêtre PiP, la garde au-dessus
 * et exécute les gestes que la page annonce dans son titre (`pipCaptions.ts`) :
 * sous Wayland, un client ne place pas ses fenêtres. Ailleurs, Electron sait
 * le faire : la coquille applique elle-même les règles de la colle
 * (`pipPlacement.ts`), et le titre n'est plus qu'un nom.
 *
 * - flottant : coin bas-droit de la zone utile de l'écran de l'application,
 *   au-dessus des autres fenêtres, sur tous les bureaux — plein écran compris ;
 * - ancré : coin bas-droit de la zone de contenu de l'application, fenêtre
 *   FILLE de celle-ci — elle la suit, reste devant elle, se réduit avec elle ;
 * - glisser, tirer un coin : la page annonce le geste (`pip_gesture`) et tient
 *   le bouton ; la coquille suit le curseur le temps du geste, une image sur
 *   deux à 120 Hz — rien entre deux gestes.
 *
 * Sur macOS la fenêtre de mpv est fille du PiP (`video/macosPipParent.ts`) :
 * elle le suit d'elle-même ; la surface la recale à chaque changement de
 * taille.
 */

import { screen, type BrowserWindow } from "electron";
import type { PipGesture, PipMode, PipPoint } from "./pipCaptions";
import { PIP_MAX_SHARE, pipWindowSize } from "./pipFrame";
import { cornerPlacement, dragTo, resizeInPlace, stretchFrom, type Box, type PipCorner } from "./pipPlacement";

/** Le curseur suivi pendant un geste — une image à 60 Hz. */
const FOLLOW_MS = 16;

/** La coquille mène-t-elle le PiP ? Partout sauf sous Linux, où c'est la colle. */
export function shellDrivesPip(): boolean {
  return process.platform === "darwin" || process.platform === "win32";
}

interface Gesture {
  kind: PipGesture;
  start: Box;
  /** Le point saisi, dans la fenêtre — glisser le garde sous le curseur. */
  grab: PipPoint;
  /** Le curseur au début du geste — tirer un coin part de là. */
  origin: PipPoint;
}

function sameBox(a: Box, b: Box): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

export class PipShell {
  private gesture: Gesture | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  /** Ancré, le PiP suit la zone de contenu de l'application. */
  private readonly hostChanged = (): void => {
    if (this.mode === "docked" && this.gesture === null) this.place();
  };

  constructor(
    private readonly pip: BrowserWindow,
    private readonly host: BrowserWindow,
    private mode: PipMode,
  ) {
    host.on("resize", this.hostChanged);
    host.on("move", this.hostChanged);
    this.applyMode();
    this.place();
  }

  /**
   * Bascule le mode. Comme la colle : vers « flottant », le PiP reste où il
   * est ; vers « ancré », il se range dans le coin de l'application.
   */
  setMode(mode: PipMode, width?: number, height?: number): void {
    this.endGesture();
    this.mode = mode;
    this.applyMode();
    if (width !== undefined && height !== undefined) this.resize(width, height);
    else if (mode === "docked") this.place();
  }

  /** Une nouvelle taille de VIDÉO (molette) : le coin le plus proche du bord reste fixe. */
  resize(width: number, height: number): void {
    if (this.pip.isDestroyed()) return;
    const size = pipWindowSize(width, height);
    if (this.mode === "docked") return this.place(size);
    this.setBounds(resizeInPlace(this.pip.getBounds(), size, this.displayOf(this.pip.getBounds()).workArea));
  }

  /** Le geste que la page commence — ou finit (`null`). */
  setGesture(kind: PipGesture | null, grab?: PipPoint): void {
    this.endGesture();
    // Ancré, le PiP est le coin de l'application : il ne se glisse pas.
    if (kind === null || this.pip.isDestroyed() || (kind === "move" && this.mode === "docked")) return;
    const start = this.pip.getBounds();
    const cursor = screen.getCursorScreenPoint();
    this.gesture = {
      kind,
      start,
      grab: grab ?? { x: cursor.x - start.x, y: cursor.y - start.y },
      origin: cursor,
    };
    this.timer = setInterval(() => this.follow(), FOLLOW_MS);
  }

  dispose(): void {
    this.endGesture();
    if (this.host.isDestroyed()) return;
    this.host.off("resize", this.hostChanged);
    this.host.off("move", this.hostChanged);
  }

  private follow(): void {
    const gesture = this.gesture;
    if (gesture === null || this.pip.isDestroyed()) return this.endGesture();
    const cursor = screen.getCursorScreenPoint();
    if (gesture.kind === "move") {
      const area = screen.getDisplayNearestPoint(cursor).workArea;
      return this.setBounds(dragTo(gesture.start, gesture.grab, cursor, area));
    }
    const dx = cursor.x - gesture.origin.x;
    const dy = cursor.y - gesture.origin.y;
    this.setBounds(stretchFrom(gesture.start, gesture.kind as PipCorner, dx, dy, this.maxVideoWidth()));
  }

  private endGesture(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.gesture = null;
  }

  /** La plus grande largeur de vidéo : 60 % de l'écran flottant, 45 % de l'application ancré. */
  private maxVideoWidth(): number {
    if (this.mode === "docked") return this.host.getContentBounds().width * PIP_MAX_SHARE.docked;
    return this.displayOf(this.pip.getBounds()).bounds.width * PIP_MAX_SHARE.floating;
  }

  /** Le PiP dans son coin : celui de l'écran de l'application, ou de l'application. */
  private place(size?: { width: number; height: number }): void {
    if (this.pip.isDestroyed() || this.host.isDestroyed()) return;
    const area = this.mode === "docked" ? this.host.getContentBounds() : this.displayOf(this.host.getBounds()).workArea;
    this.setBounds(cornerPlacement(size ?? this.pip.getBounds(), area));
  }

  /**
   * Flottant : au-dessus des fenêtres ordinaires, sur tous les bureaux, plein
   * écran compris. `skipTransformProcessType` : sans lui, Electron fait passer
   * l'application en « agent » le temps du geste — l'icône du Dock clignote.
   * Ancré : fille de l'application, qu'elle suit et devant qui elle reste.
   */
  private applyMode(): void {
    if (this.pip.isDestroyed()) return;
    if (this.mode === "floating") {
      this.pip.setParentWindow(null);
      this.pip.setAlwaysOnTop(true, "floating");
      this.pip.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true });
      return;
    }
    this.pip.setVisibleOnAllWorkspaces(false, { skipTransformProcessType: true });
    this.pip.setAlwaysOnTop(false);
    if (!this.host.isDestroyed()) this.pip.setParentWindow(this.host);
  }

  private displayOf(box: Box): Electron.Display {
    return screen.getDisplayMatching(box);
  }

  private setBounds(box: Box): void {
    if (this.pip.isDestroyed() || sameBox(this.pip.getBounds(), box)) return;
    this.pip.setBounds(box);
  }
}
