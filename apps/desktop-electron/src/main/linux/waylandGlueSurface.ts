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
 * # La contre-lecture, parce que « posée » a déjà menti
 *
 * Une pose peut réussir de bout en bout côté D-Bus et n'avoir RIEN collé : le
 * compositeur construit le composant QML pour son compte, et son échec ne
 * remonte pas (voir `kwinGlue.ts`). On mesure donc, une fois la fenêtre mpv
 * née : si elle n'a pas la taille de la nôtre, on repose la colle — une fois —
 * et on le dit. Le journal ne porte plus une promesse, il porte deux tailles.
 */

import { screen, type BrowserWindow } from "electron";
import type { VideoSurface } from "../video/surface";
import { getProperty } from "../video/mpv";
import { measureDescription, mpvNumber, glueVerdict, type GlueVerdict } from "./glueCheck";
import { KwinGlue } from "./kwinGlue";

/**
 * Le temps que la fenêtre mpv naisse et soit mappée avant qu'on la mesure.
 * Même ordre de grandeur que la reprise d'activation de `surfaceWayland.ts`,
 * pour la même raison : mesurer plus tôt, c'est mesurer une fenêtre absente.
 */
const CHECK_DELAY_MS = 400;

export class SurfaceWaylandGlue implements VideoSurface {
  private glue: KwinGlue | null = null;
  /** Coupe les vérifications en vol : `detach()` ouvre une ère nouvelle. */
  private epoch = 0;
  private checkTimer: ReturnType<typeof setTimeout> | null = null;
  private verdict: GlueVerdict = "indécidable";
  private reapplied = false;
  /** Plus rien à mesurer : la colle est prouvée, ou définitivement perdue. */
  private settled = false;

  constructor(private readonly host: BrowserWindow) {}

  async attach(): Promise<void> {
    if (this.host.isDestroyed()) return;
    const glue = new KwinGlue();
    if (await glue.apply()) {
      this.glue = glue;
      console.info("[video] Wayland : colle KWin posée — la vidéo suit la fenêtre");
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

  /** mpv vient d'ouvrir un fichier : sa fenêtre est née, elle se mesure. */
  fileLoaded(): void {
    if (this.glue === null || this.settled || this.checkTimer !== null) return;
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
    if (this.epoch !== epoch || this.glue === null || measure === null) return;
    this.verdict = measure.verdict;
    if (measure.verdict === "collée") {
      this.settled = true;
      console.info(`[video] colle vérifiée — ${measure.description}`);
      return;
    }
    if (this.reapplied) {
      this.settled = true;
      console.warn(`[video] colle SANS EFFET après une seconde pose — ${measure.description}`);
      return;
    }
    this.reapplied = true;
    console.warn(`[video] colle sans effet — ${measure.description} ; seconde pose`);
    await this.reapply();
    if (this.epoch !== epoch || this.glue === null) return;
    this.armCheck();
  }

  /**
   * La mesure, ou `null` quand elle ne veut rien dire — fenêtre réduite ou
   * détruite, sortie vidéo pas encore montée. On ne repose JAMAIS une colle
   * sur un doute : elle marche peut-être très bien.
   */
  private async takeMeasure(): Promise<{ verdict: GlueVerdict; description: string } | null> {
    if (this.host.isDestroyed() || this.host.isMinimized()) return null;
    const width = await this.mpvSize("w", "osd-width");
    const height = await this.mpvSize("h", "osd-height");
    const b = this.host.getBounds();
    const host = { width: b.width, height: b.height };
    const scale = screen.getDisplayMatching(b).scaleFactor;
    const mpv = width === null || height === null ? null : { width, height };
    const verdict = glueVerdict(mpv, host, scale);
    if (verdict === "indécidable") return null;
    return { verdict, description: measureDescription(mpv, host, scale) };
  }

  /** `osd-dimensions` d'abord, les propriétés historiques en repli. */
  private async mpvSize(field: "w" | "h", fallback: string): Promise<number | null> {
    const dimension = mpvNumber(await getProperty(`osd-dimensions/${field}`));
    return dimension ?? mpvNumber(await getProperty(fallback));
  }

  private async reapply(): Promise<void> {
    const previous = this.glue;
    this.glue = null;
    if (previous !== null) await previous.remove();
    const fresh = new KwinGlue();
    if (await fresh.apply()) {
      this.glue = fresh;
      return;
    }
    console.warn("[video] seconde pose refusée par KWin — la fenêtre vidéo restera libre");
  }

  detach(): void {
    this.epoch += 1;
    if (this.checkTimer !== null) {
      clearTimeout(this.checkTimer);
      this.checkTimer = null;
    }
    const glue = this.glue;
    this.glue = null;
    this.verdict = "indécidable";
    this.reapplied = false;
    this.settled = false;
    // Sans attendre : le démontage du lecteur ne doit pas dépendre du bus.
    if (glue !== null) void glue.remove();
  }

  geometrie(): string {
    if (this.host.isDestroyed()) return "fenêtre détruite";
    const b = this.host.getBounds();
    return (
      `wayland-colle hôte=${String(b.width)}x${String(b.height)}+${String(b.x)}+${String(b.y)}` +
      ` pleinÉcran=${String(this.host.isFullScreen())} colle=${this.glue !== null ? "posée" : "absente"}` +
      ` témoin=${this.verdict}`
    );
  }
}
