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
 * - ancré : coin bas-droit de la zone de contenu de l'application ; il la
 *   suit, reste devant elle, se réduit avec elle — sans en être une fenêtre
 *   fille, qui perdrait la souris (`pipDocking.ts`) ;
 * - glisser, tirer un coin : la page annonce le geste (`pip_gesture`) et tient
 *   le bouton ; la coquille suit le curseur le temps du geste, une image sur
 *   deux à 120 Hz — rien entre deux gestes.
 *
 * Sur macOS la fenêtre de mpv est fille du PiP (`video/macosPipParent.ts`) :
 * elle le suit d'elle-même ; la surface la recale à chaque changement de
 * taille.
 */

import { screen, systemPreferences, type BrowserWindow } from "electron";
import { bannerInset } from "../macosTitleBar";
import type { PipGesture, PipMode, PipPoint } from "./pipCaptions";
import { PIP_INSET, PIP_MAX_SHARE, pipWindowSize } from "./pipFrame";
import { PIP_GROW_MS, PIP_MAX_STEP_MS, PIP_RESIZE_MS, PIP_SHRINK_MS, easeOutCubic, interpolateBox, pictureIn, windowAround } from "./pipMotion";
import { PipBounds, sameBox } from "./pipBounds";
import { PipDocking } from "./pipDocking";
import { followHostVisibility } from "./pipHostVisibility";
import { installResizeGuard } from "./pipResizeGuard";
import { cornerPlacement, dragTo, resizeInPlace, stretchFrom, type Box, type PipCorner } from "./pipPlacement";

/** Le curseur suivi pendant un geste, et le pas d'une animation — une image à 60 Hz. */
const FRAME_MS = 16;

/** Le réglage « Réduire les animations » du système : le PiP saute alors à sa place. */
export function reducedMotion(): boolean {
  try {
    return systemPreferences.getAnimationSettings().prefersReducedMotion;
  } catch {
    return false;
  }
}

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

export class PipShell {
  private gesture: Gesture | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private animation: { timer: ReturnType<typeof setInterval>; done: () => void } | null = null;
  /** Ancré : devant l'application, avec elle — `pipDocking.ts`. */
  private docking: PipDocking | null = null;
  /** Le redimensionnement par le système — `pipResizeGuard.ts`. */
  private readonly unguard: () => void;
  /** Windows : le PiP revient avec l'application — `pipHostVisibility.ts`. */
  private readonly unfollow: () => void;
  /** La taille voulue, et la pose du cadre — `pipBounds.ts`. */
  private readonly bounds: PipBounds;
  /** Fin d'un redimensionnement par les bords du système : la taille choisie. */
  private readonly resized = (): void => this.bounds.rememberCurrent();
  /** Le coin où le PiP se pose à son entrée — `enter`. */
  private readonly rest: Box;

  /** Ancré, le PiP suit la zone de contenu de l'application. */
  private readonly hostChanged = (): void => {
    if (this.mode === "docked" && this.gesture === null && this.animation === null) this.place();
  };

  /**
   * Le PiP naît là où le lecteur montrait l'image (`pipMotion.ts`) : il ne
   * rejoint son coin qu'une fois montré (`enter`). `aspect` : celui de la vidéo.
   */
  constructor(
    private readonly pip: BrowserWindow,
    private readonly host: BrowserWindow,
    private mode: PipMode,
    aspect: number,
  ) {
    this.bounds = new PipBounds(pip);
    pip.on("resized", this.resized);
    host.on("resize", this.hostChanged);
    host.on("move", this.hostChanged);
    this.applyMode();
    this.unguard = installResizeGuard(pip, aspect, {
      mode: () => this.mode,
      dockArea: () => this.host.getContentBounds(),
      maxVideoWidth: () => this.maxVideoWidth(),
    });
    this.unfollow = followHostVisibility(pip, host, () => {
      this.applyMode();
      if (this.mode === "docked") this.place();
    });
    this.rest = cornerPlacement(this.bounds.size, this.cornerArea());
    this.bounds.set(reducedMotion() ? this.rest : windowAround(pictureIn(this.playerArea(), aspect)));
  }

  /** Le PiP montré : l'image glisse du lecteur à son coin. */
  enter(): void {
    void this.animate(this.rest, PIP_SHRINK_MS);
  }

  /**
   * Le retour au lecteur : l'image regagne la place qu'elle y aura, puis la
   * page ferme le PiP — la vidéo change de parent sans bouger d'un point.
   */
  restore(): Promise<void> {
    this.endGesture();
    if (this.pip.isDestroyed() || this.host.isDestroyed()) return Promise.resolve();
    const now = this.pip.getBounds();
    const aspect = (now.width - 2 * PIP_INSET) / Math.max(1, now.height - 2 * PIP_INSET);
    return this.animate(windowAround(pictureIn(this.playerArea(), aspect)), PIP_GROW_MS);
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

  /**
   * Une nouvelle taille de VIDÉO (molette) : le coin le plus proche du bord
   * reste fixe, et la taille y GLISSE — un cran de 10 % sautait d'un coup.
   * Chaque cran repart de là où en est le précédent.
   */
  resize(width: number, height: number): void {
    if (this.pip.isDestroyed()) return;
    const size = pipWindowSize(width, height);
    this.bounds.remember(size);
    const target =
      this.mode === "docked"
        ? cornerPlacement(size, this.cornerArea())
        : resizeInPlace(this.pip.getBounds(), size, this.displayOf(this.pip.getBounds()).workArea);
    void this.animate(target, PIP_RESIZE_MS);
  }

  /** Le geste que la page commence — ou finit (`null`). */
  setGesture(kind: PipGesture | null, grab?: PipPoint): void {
    this.endGesture();
    // Un geste interrompt l'entrée : la main l'emporte toujours.
    this.stopAnimation();
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
    this.timer = setInterval(() => this.follow(), FRAME_MS);
  }

  dispose(): void {
    this.endGesture();
    this.stopAnimation();
    this.docking?.stop();
    this.docking = null;
    this.unguard();
    this.unfollow();
    if (!this.pip.isDestroyed()) this.pip.off("resized", this.resized);
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
      return this.bounds.set(dragTo(gesture.start, gesture.grab, cursor, area));
    }
    const dx = cursor.x - gesture.origin.x;
    const dy = cursor.y - gesture.origin.y;
    this.bounds.set(stretchFrom(gesture.start, gesture.kind as PipCorner, dx, dy, this.maxVideoWidth()));
  }

  private endGesture(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    // Un coin tiré : la taille où la main l'a laissé devient la taille voulue.
    if (this.gesture !== null && this.gesture.kind !== "move") this.bounds.rememberCurrent();
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
    this.bounds.set(cornerPlacement(size ?? this.bounds.size, this.cornerArea()));
  }

  private cornerArea(): Box {
    return this.mode === "docked" ? this.host.getContentBounds() : this.displayOf(this.host.getBounds()).workArea;
  }

  /** La zone où le lecteur montre la vidéo — sous le bandeau, comme `macosFrame.ts`. */
  private playerArea(): Box {
    const content = this.host.getContentBounds();
    const top = bannerInset(this.host);
    return { ...content, y: content.y + top, height: content.height - top };
  }

  /** Une image par pas, courbe décélérée ; interrompue par un geste ou une autre animation. */
  private animate(to: Box, duration: number): Promise<void> {
    this.stopAnimation();
    if (this.pip.isDestroyed()) return Promise.resolve();
    const from = this.pip.getBounds();
    if (reducedMotion() || sameBox(from, to)) {
      this.bounds.set(to);
      return Promise.resolve();
    }
    let elapsed = 0;
    let last = Date.now();
    return new Promise((done) => {
      const step = (): void => {
        if (this.pip.isDestroyed()) return this.stopAnimation();
        const now = Date.now();
        elapsed += Math.min(now - last, PIP_MAX_STEP_MS);
        last = now;
        const t = Math.min(1, elapsed / duration);
        this.bounds.set(interpolateBox(from, to, easeOutCubic(t)));
        if (t >= 1) this.stopAnimation();
      };
      this.animation = { timer: setInterval(step, FRAME_MS), done };
      step();
    });
  }

  private stopAnimation(): void {
    const running = this.animation;
    if (running === null) return;
    this.animation = null;
    clearInterval(running.timer);
    running.done();
  }

  /**
   * Flottant : au-dessus des fenêtres ordinaires, sur tous les bureaux, plein
   * écran compris. `skipTransformProcessType` : sans lui, Electron fait passer
   * l'application en « agent » le temps du geste — l'icône du Dock clignote.
   * Ancré : devant l'application seulement, qu'il suit — `pipDocking.ts`.
   */
  private applyMode(): void {
    if (this.pip.isDestroyed()) return;
    this.docking?.stop();
    this.docking = null;
    if (this.mode === "floating") {
      // Windows : détaché, le PiP n'a plus de propriétaire — jamais caché avec
      // la fenêtre principale (`pipHostVisibility.ts`).
      if (process.platform === "win32") this.pip.setParentWindow(null);
      this.pip.setAlwaysOnTop(true, "floating");
      this.pip.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true });
      return;
    }
    this.pip.setVisibleOnAllWorkspaces(false, { skipTransformProcessType: true });
    if (this.host.isDestroyed()) return;
    this.docking = new PipDocking(this.pip, this.host);
    this.docking.start();
  }

  private displayOf(box: Box): Electron.Display {
    return screen.getDisplayMatching(box);
  }
}
