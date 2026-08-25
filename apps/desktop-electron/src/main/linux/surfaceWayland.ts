/**
 * La surface vidéo sur Wayland : deux fenêtres plein écran, et rien à caler.
 *
 * # Pourquoi il n'y a rien à caler
 *
 * Wayland n'autorise pas un client à donner une position à ses fenêtres — c'est
 * une règle du protocole, pas un manque. La fenêtre de mpv ne peut donc pas être
 * posée sur la nôtre au pixel près, comme le fait `videoWindow.ts` sous Windows.
 *
 * Le plein écran est la seule géométrie où la question ne se pose plus : les deux
 * fenêtres couvrent la même sortie, et le compositeur s'occupe du reste.
 * `align()` est donc vide, et ce vide est le montage lui-même.
 *
 * # Pourquoi la nôtre reste au-dessus
 *
 * Mesuré le 25.08.2026 sur KWin 6.7.4, capture à l'appui : notre fenêtre
 * transparente plein écran reste devant la fenêtre plein écran de mpv, et la
 * vidéo se voit au travers. Deux conditions, toutes deux posées ailleurs :
 *
 *  - `transparent: true` à la CONSTRUCTION (`linux/fenetre.ts`) — sans quoi la
 *    page peint du noir par-dessus la vidéo ;
 *  - `focus-on=never` côté mpv (`mpvRuntime.ts`) — sa fenêtre ne réclame jamais
 *    l'activation, donc le compositeur ne la remonte jamais devant la nôtre.
 *
 * # Le seul calage qui reste : l'ÉCRAN
 *
 * Ni nous ni mpv ne choisissons où le compositeur met une fenêtre en plein
 * écran. Sur un poste à plusieurs moniteurs, les deux partaient donc sur des
 * écrans différents — mesuré : notre fenêtre sur le Dell, la surface de mpv sur
 * l'ASUS. L'utilisateur voyait son interface d'un côté et rien de l'autre.
 *
 * mpv sait viser un écran (`fs-screen-name`), mais n'accepte que le nom de
 * CONNECTEUR — `DP-3`, pas « Dell Inc. DELL S2721DGF ». Le rapprochement passe
 * par l'EDID que publie le noyau ; voir `ecrans.ts`.
 *
 * # Ce que ça coûte, et qui l'a décidé
 *
 * La lecture en fenêtre n'existe pas sur Wayland. C'est le prix du HDR, qui
 * n'existe QUE là (X11 n'en aura jamais). L'utilisateur qui préfère l'inverse
 * bascule le réglage de session sur `x11` — voir `sessionGraphique.ts`.
 *
 * Conséquence directe : tant qu'une vidéo est attachée, la fenêtre RESTE en plein
 * écran. En sortir laisserait la vidéo de mpv couvrir tout l'écran derrière une
 * fenêtre réduite — le bureau montrerait un film que plus rien ne commande.
 */

import { screen, type BrowserWindow } from "electron";
import { connecteurPourLibelle, ecransConnectes } from "./ecrans";
import { setProperty } from "../video/mpv";
import type { VideoSurface } from "../video/surface";

export class SurfaceWayland implements VideoSurface {
  /** L'état du plein écran avant la lecture, pour le rendre en sortant. */
  private avant: boolean | null = null;
  /** Dernier écran visé, pour ne pas réécrire ni ré-avertir à chaque évènement. */
  private dernierConnecteur: string | null = null;
  private dernierLibelle: string | null = null;
  private readonly reprendrePleinEcran = (): void => {
    if (this.avant === null || this.host.isDestroyed()) return;
    // Deux fenêtres plein écran, dont une seule est commandable : en sortir
    // laisserait la vidéo couvrir l'écran sans plus rien pour l'arrêter.
    console.info("[video] Wayland : plein écran réaffirmé, la vidéo y est liée");
    this.host.setFullScreen(true);
  };

  constructor(private readonly host: BrowserWindow) {}

  attach(): void {
    if (this.host.isDestroyed()) return;
    // AVANT le plein écran, et avant que mpv ne crée sa fenêtre au premier
    // `loadfile` : c'est le seul moment où le réglage porte.
    this.viserNotreEcran();
    this.avant = this.host.isFullScreen();
    this.host.setFullScreen(true);
    // L'activation est ce qui fixe l'ordre : notre fenêtre devient la dernière
    // servie, celle de mpv ne le demande jamais.
    this.host.focus();
    this.host.on("leave-full-screen", this.reprendrePleinEcran);
  }

  /**
   * Wayland ne place pas les fenêtres : il n'y a rien à caler, et c'est voulu.
   *
   * L'écran, lui, se rejoue — un changement de géométrie peut vouloir dire que
   * l'utilisateur a déplacé la fenêtre sur un autre moniteur.
   */
  align(): void {
    this.viserNotreEcran();
  }

  /** Dit à mpv d'aller en plein écran sur NOTRE moniteur, s'il est identifiable. */
  private viserNotreEcran(): void {
    if (this.host.isDestroyed()) return;
    const libelle = screen.getDisplayMatching(this.host.getBounds()).label;
    const connecteur = connecteurPourLibelle(libelle, ecransConnectes());
    if (connecteur === null) {
      // Sans correspondance on ne force rien : mpv choisira, ce qui reste mieux
      // que de l'envoyer sur un écran arbitraire. Tracé une fois par écran.
      if (this.dernierLibelle !== libelle) {
        console.warn(`[video] écran « ${libelle} » non rapproché d'un connecteur — mpv choisira`);
        this.dernierLibelle = libelle;
      }
      return;
    }
    if (connecteur === this.dernierConnecteur) return;
    this.dernierConnecteur = connecteur;
    this.dernierLibelle = libelle;
    console.info(`[video] mpv visera ${connecteur} (${libelle})`);
    void setProperty("fs-screen-name", connecteur);
  }

  /** Rien à désarmer : `focus-on=never` suffit, la fenêtre de mpv ne prend rien. */
  harden(): boolean {
    return false;
  }

  detach(): void {
    if (this.host.isDestroyed()) return;
    this.host.removeListener("leave-full-screen", this.reprendrePleinEcran);
    const avant = this.avant;
    this.avant = null;
    this.dernierConnecteur = null;
    // On ne défait QUE le plein écran qu'on a posé : celui d'un utilisateur qui
    // parcourait déjà son catalogue ainsi ne nous appartient pas.
    if (avant === false) this.host.setFullScreen(false);
  }

  geometrie(): string {
    if (this.host.isDestroyed()) return "fenêtre détruite";
    const b = this.host.getBounds();
    const ecran = this.dernierConnecteur ?? "auto";
    return `wayland hôte=${b.width}x${b.height}+${b.x}+${b.y} pleinÉcran=${this.host.isFullScreen()} écran=${ecran}`;
  }
}
