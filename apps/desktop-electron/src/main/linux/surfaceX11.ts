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
  affichageX11,
  numeroFenetreX11,
  passerSous,
  poserRectangle,
  synchroniser,
  trouverFenetreMpv,
} from "./x11";
import type { VideoSurface } from "../video/surface";

/** Cadence du sondage, et nombre maximal de tentatives (10 s en tout). */
const SONDAGE_MS = 100;
const SONDAGES_MAX = 100;
/** Un repositionnement par image suffit. */
const CALAGE_MS = 16;

export class SurfaceX11 implements VideoSurface {
  private hote = 0n;
  private video: bigint | null = null;
  private recherche: ReturnType<typeof setInterval> | null = null;
  private calage: ReturnType<typeof setTimeout> | null = null;
  private attache = false;

  /** Référence stable — sans elle, `off()` ne retirerait rien. */
  private readonly suivre = (): void => this.planifierCalage();

  constructor(private readonly host: BrowserWindow) {}

  attach(): void {
    if (this.attache || this.host.isDestroyed()) return;
    this.attache = true;
    this.hote = numeroFenetreX11(this.host.getNativeWindowHandle());
    // Épelés plutôt que parcourus : la signature d'`on` est surchargée par
    // évènement, et une union de noms ne s'y résout pas.
    this.host.on("resize", this.suivre);
    this.host.on("move", this.suivre);
    this.host.on("enter-full-screen", this.suivre);
    this.host.on("leave-full-screen", this.suivre);

    // La fenêtre de mpv n'existe qu'au premier `loadfile` (`force-window=no`) :
    // elle se cherche à plusieurs reprises, pas une fois.
    let essais = 0;
    this.recherche = setInterval(() => {
      const dpy = affichageX11();
      if (dpy === null) return this.arreterRecherche();
      const trouvee = trouverFenetreMpv(dpy);
      if (trouvee !== null) {
        this.arreterRecherche();
        this.video = trouvee;
        console.info(`[x11] fenêtre mpv trouvée : 0x${trouvee.toString(16)}`);
        this.align();
      } else if (++essais > SONDAGES_MAX) {
        this.arreterRecherche();
        // Tracé même en cas d'échec : « rien ne s'est passé » est le symptôme le
        // plus coûteux à diagnostiquer.
        console.warn("[x11] fenêtre mpv introuvable après 10 s");
      }
    }, SONDAGE_MS);
  }

  /**
   * Cale la vidéo sur la zone client, puis la passe sous notre fenêtre.
   *
   * ⚠️ Le serveur X travaille en pixels, Electron rend des points logiques. À
   * l'échelle 1 — le cas courant sous X11 — les deux coïncident ; sous une
   * échelle 2, s'en dispenser donnerait une vidéo au quart de la fenêtre.
   */
  align(): void {
    const dpy = affichageX11();
    if (this.video === null || dpy === null || this.host.isDestroyed()) return;
    const c = this.host.getContentBounds();
    const f = screen.getDisplayMatching(c).scaleFactor || 1;
    poserRectangle(dpy, this.video,
      Math.round(c.x * f), Math.round(c.y * f),
      Math.round(c.width * f), Math.round(c.height * f));
    passerSous(dpy, this.video, this.hote);
    synchroniser(dpy);
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
    this.arreterRecherche();
    if (this.calage !== null) clearTimeout(this.calage);
    this.calage = null;
    if (this.attache && !this.host.isDestroyed()) {
      this.host.off("resize", this.suivre);
      this.host.off("move", this.suivre);
      this.host.off("enter-full-screen", this.suivre);
      this.host.off("leave-full-screen", this.suivre);
    }
    this.attache = false;
    this.video = null;
  }

  geometrie(): string {
    if (this.host.isDestroyed()) return "fenêtre détruite";
    const c = this.host.getContentBounds();
    const v = this.video === null ? "aucune" : `0x${this.video.toString(16)}`;
    return `x11 hôte=0x${this.hote.toString(16)} client=${c.width}x${c.height}+${c.x}+${c.y} vidéo=${v}`;
  }

  /**
   * Un repositionnement par image, pas un par évènement.
   *
   * Attraper un bord de fenêtre à la souris tire des dizaines de `resize` par
   * seconde. Front descendant : le premier arme le minuteur, les suivants sont
   * absorbés, et le calage a lieu juste après le dernier.
   */
  private planifierCalage(): void {
    if (this.calage !== null) return;
    this.calage = setTimeout(() => {
      this.calage = null;
      this.align();
    }, CALAGE_MS);
  }

  private arreterRecherche(): void {
    if (this.recherche !== null) clearInterval(this.recherche);
    this.recherche = null;
  }
}
