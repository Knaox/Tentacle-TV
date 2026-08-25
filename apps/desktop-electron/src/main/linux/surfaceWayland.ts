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

import type { BrowserWindow } from "electron";
import type { VideoSurface } from "../video/surface";

export class SurfaceWayland implements VideoSurface {
  /** L'état du plein écran avant la lecture, pour le rendre en sortant. */
  private avant: boolean | null = null;
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
    this.avant = this.host.isFullScreen();
    this.host.setFullScreen(true);
    // L'activation est ce qui fixe l'ordre : notre fenêtre devient la dernière
    // servie, celle de mpv ne le demande jamais.
    this.host.focus();
    this.host.on("leave-full-screen", this.reprendrePleinEcran);
  }

  /** Wayland ne place pas les fenêtres : il n'y a rien à faire, et c'est voulu. */
  align(): void {}

  /** Rien à désarmer : `focus-on=never` suffit, la fenêtre de mpv ne prend rien. */
  harden(): boolean {
    return false;
  }

  detach(): void {
    if (this.host.isDestroyed()) return;
    this.host.removeListener("leave-full-screen", this.reprendrePleinEcran);
    const avant = this.avant;
    this.avant = null;
    // On ne défait QUE le plein écran qu'on a posé : celui d'un utilisateur qui
    // parcourait déjà son catalogue ainsi ne nous appartient pas.
    if (avant === false) this.host.setFullScreen(false);
  }

  geometrie(): string {
    if (this.host.isDestroyed()) return "fenêtre détruite";
    const b = this.host.getBounds();
    return `wayland hôte=${b.width}x${b.height}+${b.x}+${b.y} pleinÉcran=${this.host.isFullScreen()}`;
  }
}
