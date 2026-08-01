/**
 * Fenêtre vidéo de mpv, enfant de la fenêtre principale.
 *
 * # L'architecture, en une phrase
 *
 * mpv dessine dans SA fenêtre, placée SOUS la surface de Chromium ; la surface
 * de Chromium est transparente le temps d'une lecture, l'image traverse, et les
 * contrôles HTML se composent par-dessus. Aucun rendu hors écran, aucun
 * compositeur à nous.
 *
 * Vérifié en phase 4 sur du 4K Dolby Vision : `bt.2020`/`pq` transmis à l'écran,
 * décodage `d3d11va`, zéro image perdue.
 *
 * # Les deux pièges
 *
 * 1. **La fenêtre transparente d'Electron n'est pas « layered ».** Windows ne
 *    dessine pas les filles d'une fenêtre `WS_EX_LAYERED` ; si Chromium en
 *    utilisait une, cette architecture serait morte. Il passe par
 *    DirectComposition, et les filles restent composées normalement.
 * 2. **La fenêtre de mpv appartient à un AUTRE thread.** La toucher en synchrone
 *    bloque le nôtre, et elle doit être désarmée dès qu'elle existe — pas quand
 *    la page le demande. Voir `win32.ts`.
 *
 * Tous les appels Win32 vivent dans `win32.ts` ; ici, uniquement l'orchestration.
 */

import type { BrowserWindow } from "electron";
import {
  calerSous,
  desarmer,
  nativeHandle,
  sansFaillir,
  trace,
  trouverFenetreMpv,
} from "./win32";

export { nativeHandle } from "./win32";

/** Cadence du sondage, et nombre maximal de tentatives (10 s en tout). */
const SONDAGE_MS = 100;
const SONDAGES_MAX = 100;
/** Un repositionnement par image suffit — voir `planifierCalage`. */
const CALAGE_MS = 16;

/**
 * Suit la fenêtre vidéo de mpv et la maintient calée sous l'interface.
 *
 * La fenêtre de mpv n'existe qu'APRÈS `mpv_initialize`, et de façon
 * asynchrone : il faut la chercher à plusieurs reprises. Constaté en phase 0.
 *
 * ⚠️ **C'est cette classe qui possède les écouteurs de géométrie**, et pas
 * l'appelant. Ils vivaient dans `mpv_init`, où rien ne les retirait : le
 * lecteur étant remonté à chaque épisode (`key={itemId}`), ils s'accumulaient
 * sans fin. Un seul propriétaire du calage, qui s'abonne à `attach` et se
 * désabonne à `detach`.
 */
export class VideoWindow {
  private readonly parent: bigint;
  private mpvHwnd = 0n;
  private recherche: ReturnType<typeof setInterval> | null = null;
  private attache = false;
  private calage: ReturnType<typeof setTimeout> | null = null;

  /** Référence stable — sans elle, `off()` ne retirerait rien. */
  private readonly suivre = (): void => this.planifierCalage();

  constructor(private readonly host: BrowserWindow) {
    this.parent = nativeHandle(host);
  }

  /**
   * Cherche la fenêtre de mpv jusqu'à la trouver, puis la cale et la désarme.
   *
   * ⚠️ Le désarmement se fait ICI, et nulle part ailleurs. La page appelle
   * `mpv_harden_child_window` juste après `mpv_init`, soit quelques
   * millisecondes plus tard : le premier sondage n'a alors pas eu lieu, et
   * l'ancienne version rendait `false` en silence sans jamais rien désarmer.
   * Côté Tauri, la commande fait elle-même la recherche (`mpv_window.rs:35`).
   */
  attach(): void {
    if (this.attache) return;
    this.attache = true;
    this.host.on("resize", this.suivre);
    this.host.on("enter-full-screen", this.suivre);
    this.host.on("leave-full-screen", this.suivre);

    let essais = 0;
    this.recherche = setInterval(() => {
      sansFaillir("recherche de la fenetre mpv", () => {
        const trouvee = trouverFenetreMpv(this.parent);
        if (trouvee) {
          this.stopSearch();
          this.mpvHwnd = trouvee;
          this.align();
          trace(`fenetre mpv trouvee, desarmement ${this.harden() ? "ok" : "REFUSE"}`);
        } else if (++essais > SONDAGES_MAX) {
          this.stopSearch();
          // Tracé même en cas d'échec : « rien ne s'est passé » est le symptôme
          // le plus coûteux à diagnostiquer.
          trace("fenetre mpv introuvable apres 10 s, desarmement ignore");
        }
      });
    }, SONDAGE_MS);
  }

  /**
   * Cale la fenêtre vidéo sur tout le rectangle client, SOUS la surface de
   * Chromium. À rappeler à chaque changement de géométrie : redimensionnement,
   * plein écran, passage sur un autre écran.
   */
  align(): void {
    if (!this.mpvHwnd) return;
    // Le calage part aussi d'un minuteur : la garde vaut pour les deux chemins.
    sansFaillir("calage de la fenetre video", () => calerSous(this.mpvHwnd, this.parent));
  }

  /** Désarme la fenêtre vidéo. `false` si elle n'est pas encore connue. */
  harden(): boolean {
    if (!this.mpvHwnd) return false;
    desarmer(this.mpvHwnd);
    return true;
  }

  detach(): void {
    this.stopSearch();
    if (this.calage !== null) clearTimeout(this.calage);
    this.calage = null;
    if (this.attache) {
      this.host.off("resize", this.suivre);
      this.host.off("enter-full-screen", this.suivre);
      this.host.off("leave-full-screen", this.suivre);
      this.attache = false;
    }
    this.mpvHwnd = 0n;
  }

  /**
   * Un repositionnement par image, pas un par message de Windows.
   *
   * Attraper un bord de fenêtre à la souris tire des dizaines de `resize` par
   * seconde. Front descendant : le premier évènement arme le minuteur, les
   * suivants sont absorbés, et le calage a lieu juste après le dernier.
   */
  private planifierCalage(): void {
    if (this.calage !== null) return;
    this.calage = setTimeout(() => {
      this.calage = null;
      this.align();
    }, CALAGE_MS);
  }

  private stopSearch(): void {
    if (this.recherche !== null) clearInterval(this.recherche);
    this.recherche = null;
  }
}
