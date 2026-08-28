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
import { descriptionMesure, nombreMpv, verdictColle, type VerdictColle } from "./glueCheck";
import { ColleKwin } from "./kwinGlue";

/**
 * Le temps que la fenêtre mpv naisse et soit mappée avant qu'on la mesure.
 * Même ordre de grandeur que la reprise d'activation de `surfaceWayland.ts`,
 * pour la même raison : mesurer plus tôt, c'est mesurer une fenêtre absente.
 */
const DELAI_VERIFICATION_MS = 400;

export class SurfaceWaylandColle implements VideoSurface {
  private colle: ColleKwin | null = null;
  /** Coupe les vérifications en vol : `detach()` ouvre une ère nouvelle. */
  private ere = 0;
  private verification: ReturnType<typeof setTimeout> | null = null;
  private verdict: VerdictColle = "indécidable";
  private reposee = false;
  /** Plus rien à mesurer : la colle est prouvée, ou définitivement perdue. */
  private acheve = false;

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

  /** mpv vient d'ouvrir un fichier : sa fenêtre est née, elle se mesure. */
  fichierCharge(): void {
    if (this.colle === null || this.acheve || this.verification !== null) return;
    this.armerVerification();
  }

  private armerVerification(): void {
    this.verification = setTimeout(() => {
      this.verification = null;
      void this.verifier();
    }, DELAI_VERIFICATION_MS);
  }

  private async verifier(): Promise<void> {
    const ere = this.ere;
    const mesure = await this.mesurer();
    if (this.ere !== ere || this.colle === null || mesure === null) return;
    this.verdict = mesure.verdict;
    if (mesure.verdict === "collée") {
      this.acheve = true;
      console.info(`[video] colle vérifiée — ${mesure.description}`);
      return;
    }
    if (this.reposee) {
      this.acheve = true;
      console.warn(`[video] colle SANS EFFET après une seconde pose — ${mesure.description}`);
      return;
    }
    this.reposee = true;
    console.warn(`[video] colle sans effet — ${mesure.description} ; seconde pose`);
    await this.reposer();
    if (this.ere !== ere || this.colle === null) return;
    this.armerVerification();
  }

  /**
   * La mesure, ou `null` quand elle ne veut rien dire — fenêtre réduite ou
   * détruite, sortie vidéo pas encore montée. On ne repose JAMAIS une colle
   * sur un doute : elle marche peut-être très bien.
   */
  private async mesurer(): Promise<{ verdict: VerdictColle; description: string } | null> {
    if (this.host.isDestroyed() || this.host.isMinimized()) return null;
    const largeur = await this.tailleMpv("w", "osd-width");
    const hauteur = await this.tailleMpv("h", "osd-height");
    const b = this.host.getBounds();
    const hote = { largeur: b.width, hauteur: b.height };
    const echelle = screen.getDisplayMatching(b).scaleFactor;
    const mpv = largeur === null || hauteur === null ? null : { largeur, hauteur };
    const verdict = verdictColle(mpv, hote, echelle);
    if (verdict === "indécidable") return null;
    return { verdict, description: descriptionMesure(mpv, hote, echelle) };
  }

  /** `osd-dimensions` d'abord, les propriétés historiques en repli. */
  private async tailleMpv(champ: "w" | "h", repli: string): Promise<number | null> {
    const dimension = nombreMpv(await getProperty(`osd-dimensions/${champ}`));
    return dimension ?? nombreMpv(await getProperty(repli));
  }

  private async reposer(): Promise<void> {
    const ancienne = this.colle;
    this.colle = null;
    if (ancienne !== null) await ancienne.retirer();
    const neuve = new ColleKwin();
    if (await neuve.poser()) {
      this.colle = neuve;
      return;
    }
    console.warn("[video] seconde pose refusée par KWin — la fenêtre vidéo restera libre");
  }

  detach(): void {
    this.ere += 1;
    if (this.verification !== null) {
      clearTimeout(this.verification);
      this.verification = null;
    }
    const colle = this.colle;
    this.colle = null;
    this.verdict = "indécidable";
    this.reposee = false;
    this.acheve = false;
    // Sans attendre : le démontage du lecteur ne doit pas dépendre du bus.
    if (colle !== null) void colle.retirer();
  }

  geometrie(): string {
    if (this.host.isDestroyed()) return "fenêtre détruite";
    const b = this.host.getBounds();
    return (
      `wayland-colle hôte=${String(b.width)}x${String(b.height)}+${String(b.x)}+${String(b.y)}` +
      ` pleinÉcran=${String(this.host.isFullScreen())} colle=${this.colle !== null ? "posée" : "absente"}` +
      ` témoin=${this.verdict}`
    );
  }
}
