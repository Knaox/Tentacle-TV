/**
 * La surface vidéo sous X11 : la fenêtre de mpv calée sous la nôtre.
 *
 * Le pendant exact de `videoWindow.ts` — même cycle de vie, même sondage, même
 * calage à l'image — mais sans embarquement : mpv ouvre sa PROPRE fenêtre de
 * premier niveau, et on la place. `--wid` n'est pas utilisé, et ce n'est pas un
 * oubli : une fenêtre X enfant est toujours dessinée AU-DESSUS du contenu de son
 * parent, donc au-dessus des contrôles HTML. C'est la limite dite « airspace »,
 * celle-là même qui avait fait passer l'app Tauri à la Render API.
 *
 * ⚠️ **Un compositeur est nécessaire.** Sans composition, X11 ne mélange pas le
 * canal alpha : notre fenêtre transparente peint du noir et masque la vidéo.
 * Mesuré, mêmes fenêtres, capture à l'appui — 0 % de vidéo visible sous openbox
 * nu, 92,7 % dès qu'un compositeur tourne. Tous les bureaux modernes composent.
 *
 * Mesuré le 25.08.2026 sur serveur X imbriqué, fenêtre de 900x532 sur un écran
 * de 1600x900 : la vidéo occupe la zone client au pixel, le repère HTML se
 * compose par-dessus.
 */

import { screen, type BrowserWindow } from "electron";
import {
  x11Display,
  x11WindowNumber,
  moveBelow,
  setRectangle,
  sync,
  findMpvWindow,
} from "./x11";
import type { VideoSurface } from "../video/surface";

/** Cadence du sondage, et nombre maximal de tentatives (10 s en tout). */
const POLL_MS = 100;
const POLL_MAX = 100;
/** Un repositionnement par image suffit. */
const ALIGN_MS = 16;

export class SurfaceX11 implements VideoSurface {
  private hostWid = 0n;
  private video: bigint | null = null;
  private search: ReturnType<typeof setInterval> | null = null;
  private alignTimer: ReturnType<typeof setTimeout> | null = null;
  private attached = false;

  /** Référence stable — sans elle, `off()` ne retirerait rien. */
  private readonly follow = (): void => this.scheduleAlign();

  constructor(private readonly host: BrowserWindow) {}

  attach(): void {
    if (this.attached || this.host.isDestroyed()) return;
    this.attached = true;
    this.hostWid = x11WindowNumber(this.host.getNativeWindowHandle());
    // Épelés plutôt que parcourus : la signature d'`on` est surchargée par
    // évènement, et une union de noms ne s'y résout pas.
    this.host.on("resize", this.follow);
    this.host.on("move", this.follow);
    this.host.on("enter-full-screen", this.follow);
    this.host.on("leave-full-screen", this.follow);

    // La fenêtre de mpv n'existe qu'au premier `loadfile` (`force-window=no`) :
    // elle se cherche à plusieurs reprises, pas une fois.
    let tries = 0;
    this.search = setInterval(() => {
      const dpy = x11Display();
      if (dpy === null) return this.stopSearch();
      const found = findMpvWindow(dpy);
      if (found !== null) {
        this.stopSearch();
        this.video = found;
        console.info(`[x11] fenêtre mpv trouvée : 0x${found.toString(16)}`);
        this.align();
      } else if (++tries > POLL_MAX) {
        this.stopSearch();
        // Tracé même en cas d'échec : « rien ne s'est passé » est le symptôme le
        // plus coûteux à diagnostiquer.
        console.warn("[x11] fenêtre mpv introuvable après 10 s");
      }
    }, POLL_MS);
  }

  /**
   * Cale la vidéo sur la zone client, puis la passe sous notre fenêtre.
   *
   * ⚠️ Le serveur X travaille en pixels, Electron rend des points logiques. À
   * l'échelle 1 — le cas courant sous X11 — les deux coïncident ; sous une
   * échelle 2, s'en dispenser donnerait une vidéo au quart de la fenêtre.
   */
  align(): void {
    const dpy = x11Display();
    if (this.video === null || dpy === null || this.host.isDestroyed()) return;
    const c = this.host.getContentBounds();
    const f = screen.getDisplayMatching(c).scaleFactor || 1;
    setRectangle(dpy, this.video,
      Math.round(c.x * f), Math.round(c.y * f),
      Math.round(c.width * f), Math.round(c.height * f));
    moveBelow(dpy, this.video, this.hostWid);
    sync(dpy);
  }

  /**
   * Rien à désarmer : la fenêtre est SOUS la nôtre, qui couvre exactement la
   * même zone — aucun clic ne l'atteint. `input-cursor=no` et `focus-on=never`
   * font le reste côté mpv.
   */
  harden(): boolean {
    return false;
  }

  detach(): void {
    this.stopSearch();
    if (this.alignTimer !== null) clearTimeout(this.alignTimer);
    this.alignTimer = null;
    if (this.attached && !this.host.isDestroyed()) {
      this.host.off("resize", this.follow);
      this.host.off("move", this.follow);
      this.host.off("enter-full-screen", this.follow);
      this.host.off("leave-full-screen", this.follow);
    }
    this.attached = false;
    this.video = null;
  }

  geometrie(): string {
    if (this.host.isDestroyed()) return "fenêtre détruite";
    const c = this.host.getContentBounds();
    const v = this.video === null ? "aucune" : `0x${this.video.toString(16)}`;
    return `x11 hôte=0x${this.hostWid.toString(16)} client=${c.width}x${c.height}+${c.x}+${c.y} vidéo=${v}`;
  }

  /**
   * Un repositionnement par image, pas un par évènement.
   *
   * Attraper un bord de fenêtre à la souris tire des dizaines de `resize` par
   * seconde. Front descendant : le premier arme le minuteur, les suivants sont
   * absorbés, et le calage a lieu juste après le dernier.
   */
  private scheduleAlign(): void {
    if (this.alignTimer !== null) return;
    this.alignTimer = setTimeout(() => {
      this.alignTimer = null;
      this.align();
    }, ALIGN_MS);
  }

  private stopSearch(): void {
    if (this.search !== null) clearInterval(this.search);
    this.search = null;
  }
}
