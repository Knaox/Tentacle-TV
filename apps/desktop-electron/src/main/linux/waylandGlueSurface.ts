/**
 * La surface vidéo Wayland FENÊTRÉE : mpv collé sous notre fenêtre par KWin.
 *
 * C'est le montage retenu quand le compositeur offre son API de script
 * (`kwinScripting.ts`) : la lecture se comporte comme sur Windows — elle suit
 * la fenêtre, fenêtrée ou plein écran, et n'impose RIEN. Le plein écran est
 * celui de NOTRE fenêtre (F11, bouton du lecteur) ; la colle suit sa
 * géométrie, quelle qu'elle soit. Là où l'API manque (GNOME, wlroots), c'est
 * `surfaceWayland.ts` — le montage plein écran forcé — qui reprend.
 *
 * Il n'y a NI visée d'écran (`fs-screen-name`), ni plein écran réaffirmé, ni
 * reprise d'activation minutée : la fenêtre mpv n'est jamais plein écran
 * d'elle-même (`mpvBaseOptions.ts`, saveur collée), donc jamais promue en couche
 * haute ; la colle tient la paire et rend l'activation à l'hôte — tout vit
 * côté compositeur une fois posé.
 *
 * # La colle est celle du PROCESSUS
 *
 * Posée à la première lecture, gardée jusqu'au départ (`liveGlue.ts`) : elle ré-adopte d'elle-même chaque fenêtre mpv suivante.
 * `attach` ne pose donc que s'il n'y a rien de vivant, et `detach` ne retire
 * rien — la décrocher à chaque épisode coûtait quatre appels D-Bus et laissait
 * des gestionnaires morts dans le compositeur.
 *
 * # La contre-lecture, parce que « posée » a déjà menti
 *
 * Une pose peut réussir de bout en bout côté D-Bus et n'avoir RIEN collé : le
 * compositeur construit le composant QML pour son compte, et son échec ne
 * remonte pas (voir `kwinGlue.ts`). On mesure donc, une fois la fenêtre mpv
 * née : si elle n'a pas la taille de la nôtre, on repose la colle — une fois —
 * et on le dit. Le journal ne porte plus une promesse, il porte deux tailles.
 *
 * ⚠️ Trois pièges de cette mesure, tous payés le 17.09.2026 — la colle était
 * reposée À CHAQUE LECTURE, pour rien (journal KWin sur sept jours) :
 *
 * - elle se prend sur `video-reconfig`, pas sur `file-loaded` : à
 *   `file-loaded` la sortie vidéo n'existe pas encore, à `video-reconfig` la
 *   fenêtre est là, à sa taille ;
 * - l'échelle vient de la PAGE (`devicePixelRatio`), jamais de
 *   `screen.getDisplayMatching(getBounds())` : sur Wayland `getBounds` rend
 *   (0,0) et désigne l'écran à l'origine — mesuré, `attendu 1440x1000 ×1.25`
 *   pour une fenêtre sur un écran ×2 qui faisait bien `2304x1656` ;
 * - un verdict « libre » se confirme par une seconde mesure : l'écriture de
 *   géométrie par la colle est asynchrone, mpv peut ne pas l'avoir encore lue.
 */

import type { BrowserWindow } from "electron";
import type { VideoSurface } from "../video/surface";
import { getProperty } from "../video/mpv";
import { pageMeasure } from "./displayTarget";
import { measureDescription, mpvNumber, glueVerdict, type GlueVerdict } from "./glueCheck";
import { ensureLiveGlue, liveGlue, reposeLiveGlue } from "./liveGlue";

/**
 * Le temps que la colle ait recopié la géométrie de l'hôte une fois la sortie
 * vidéo configurée — et, sur un doute, le temps de la remesurer.
 */
const CHECK_DELAY_MS = 300;

export class SurfaceWaylandGlue implements VideoSurface {
  /** Coupe les vérifications en vol : `detach()` ouvre une ère nouvelle. */
  private epoch = 0;
  private checkTimer: ReturnType<typeof setTimeout> | null = null;
  private verdict: GlueVerdict = "indécidable";
  /** Un premier « libre » est un doute, pas un verdict : on remesure. */
  private doubted = false;
  private reapplied = false;
  /** Plus rien à mesurer : la colle est prouvée, ou définitivement perdue. */
  private settled = false;

  constructor(private readonly host: BrowserWindow) {}

  async attach(): Promise<void> {
    if (this.host.isDestroyed()) return;
    const { live, fresh } = await ensureLiveGlue();
    if (live) {
      if (fresh) console.info("[video] Wayland : colle KWin posée — la vidéo suit la fenêtre");
      return;
    }
    // La détection disait oui mais la pose a échoué (KWin relancé, /tmp plein…).
    // La lecture reste possible — fenêtre mpv libre, non calée : l'image vaut
    // mieux qu'un refus, et le journal dit pourquoi elle flotte.
    console.warn("[video] Wayland : colle KWin refusée — vidéo non calée");
  }

  /** La colle suit `frameGeometryChanged` côté compositeur : rien à faire ici. */
  align(): void {}

  harden(): boolean {
    return false;
  }

  /** mpv vient de configurer sa sortie vidéo : sa fenêtre existe, elle se mesure. */
  videoReconfigured(): void {
    if (liveGlue() === null || this.settled || this.checkTimer !== null) return;
    this.armCheck();
  }

  private armCheck(): void {
    this.checkTimer = setTimeout(() => {
      this.checkTimer = null;
      void this.check();
    }, CHECK_DELAY_MS);
  }

  private async check(): Promise<void> {
    const epoch = this.epoch;
    const measure = await this.takeMeasure();
    if (this.epoch !== epoch || liveGlue() === null || measure === null) return;
    this.verdict = measure.verdict;
    if (measure.verdict === "collée") {
      this.settled = true;
      console.info(`[video] colle vérifiée — ${measure.description}`);
      return;
    }
    if (!this.doubted) {
      this.doubted = true;
      this.armCheck();
      return;
    }
    if (this.reapplied) {
      this.settled = true;
      console.warn(`[video] colle SANS EFFET après une seconde pose — ${measure.description}`);
      return;
    }
    this.reapplied = true;
    console.warn(`[video] colle sans effet — ${measure.description} ; seconde pose`);
    const reposed = await reposeLiveGlue();
    if (this.epoch !== epoch) return;
    if (!reposed) {
      this.settled = true;
      console.warn("[video] seconde pose refusée par KWin — la fenêtre vidéo restera libre");
      return;
    }
    this.doubted = false;
    this.armCheck();
  }

  /**
   * La mesure, ou `null` quand elle ne veut rien dire — fenêtre réduite ou
   * détruite, page muette, sortie vidéo pas encore montée. On ne repose JAMAIS
   * une colle sur un doute : elle marche peut-être très bien.
   */
  private async takeMeasure(): Promise<{ verdict: GlueVerdict; description: string } | null> {
    if (this.host.isDestroyed() || this.host.isMinimized()) return null;
    const [width, height, page] = await Promise.all([
      this.mpvSize("w", "osd-width"),
      this.mpvSize("h", "osd-height"),
      pageMeasure(this.host.webContents),
    ]);
    if (page === null) return null;
    const host = { width: page.width, height: page.height };
    const mpv = width === null || height === null ? null : { width, height };
    const verdict = glueVerdict(mpv, host, page.density);
    if (verdict === "indécidable") return null;
    return { verdict, description: measureDescription(mpv, host, page.density) };
  }

  /** `osd-dimensions` d'abord, les propriétés historiques en repli. */
  private async mpvSize(field: "w" | "h", fallback: string): Promise<number | null> {
    const dimension = mpvNumber(await getProperty(`osd-dimensions/${field}`));
    return dimension ?? mpvNumber(await getProperty(fallback));
  }

  /** La colle RESTE : elle ré-adopte d'elle-même la fenêtre mpv suivante. */
  detach(): void {
    this.epoch += 1;
    if (this.checkTimer !== null) {
      clearTimeout(this.checkTimer);
      this.checkTimer = null;
    }
    this.verdict = "indécidable";
    this.doubted = false;
    this.reapplied = false;
    this.settled = false;
  }

  geometrie(): string {
    if (this.host.isDestroyed()) return "fenêtre détruite";
    const b = this.host.getBounds();
    return (
      `wayland-colle hôte=${String(b.width)}x${String(b.height)}+${String(b.x)}+${String(b.y)}` +
      ` pleinÉcran=${String(this.host.isFullScreen())} colle=${liveGlue() !== null ? "posée" : "absente"}` +
      ` témoin=${this.verdict}`
    );
  }
}
