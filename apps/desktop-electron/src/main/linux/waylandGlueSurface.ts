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
 * d'elle-même (`optionsMpv.ts`, saveur collée), donc jamais promue en couche
 * haute ; la colle tient la paire et rend l'activation à l'hôte — tout vit
 * côté compositeur une fois posé.
 */

import type { BrowserWindow } from "electron";
import type { VideoSurface } from "../video/surface";
import { ColleKwin } from "./kwinGlue";

export class SurfaceWaylandColle implements VideoSurface {
  private colle: ColleKwin | null = null;

  constructor(private readonly host: BrowserWindow) {}

  async attach(): Promise<void> {
    if (this.host.isDestroyed()) return;
    const colle = new ColleKwin();
    if (await colle.poser()) {
      this.colle = colle;
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

  detach(): void {
    const colle = this.colle;
    this.colle = null;
    // Sans attendre : le démontage du lecteur ne doit pas dépendre du bus.
    if (colle !== null) void colle.retirer();
  }

  geometrie(): string {
    if (this.host.isDestroyed()) return "fenêtre détruite";
    const b = this.host.getBounds();
    return (
      `wayland-colle hôte=${String(b.width)}x${String(b.height)}+${String(b.x)}+${String(b.y)}` +
      ` pleinÉcran=${String(this.host.isFullScreen())} colle=${this.colle !== null ? "posée" : "absente"}`
    );
  }
}
