/**
 * La surface vidéo macOS par la Render API : une vue, dans notre fenêtre.
 *
 * Tient le même contrat que `MacosSurface` — s'attacher, suivre la géométrie,
 * se détacher — mais sans seconde fenêtre. La vue OpenGL vit dans la fenêtre
 * d'Electron, sous le contenu web, et suit ses dimensions toute seule
 * (`macosVueGl.ts`) ; mpv y dessine image par image (`macosRenderMpv.ts`).
 *
 * Ce qui disparaît avec la seconde fenêtre : le calage à la main, l'ordre
 * d'empilement à réaffirmer à chaque plein écran, le liseré transparent au bord
 * de l'overlay, et la recherche de la fenêtre de mpv parmi celles de
 * l'application.
 *
 * ⚠️ **macOS uniquement.**
 */

import type { BrowserWindow } from "electron";
import { trace } from "./native";
import { msg } from "./objc";
import { poignee } from "./mpv";
import { creerVueGl, echelle, retirerVueGl, tailleEnPixels, type VueGl } from "./macosVueGl";
import { arreterRendu, demarrerRendu, etatRendu, imagesPresentees } from "./macosRenderMpv";
import type { VideoSurface } from "./surface";

export class MacosSurfaceGl implements VideoSurface {
  private vue: VueGl | null = null;
  private facteur = 1;

  constructor(private readonly host: BrowserWindow) {}

  /**
   * Crée la vue et lance le rendu.
   *
   * ⚠️ Appelée APRÈS `mpv_initialize` : le contexte de rendu ne peut être créé
   * que sur une instance déjà initialisée, et mpv doit déjà savoir qu'il rend
   * dans `vo=libmpv`.
   */
  attach(): void {
    if (this.vue !== null) return;

    const mpv = poignee();
    if (!mpv) {
      trace("surface GL : mpv n'est pas demarre, rien a attacher");
      return;
    }

    const vue = creerVueGl(this.host);
    if (vue === null) return;

    this.vue = vue;
    this.facteur = echelle(this.host);
    const taille = tailleEnPixels(vue.vue, this.facteur);
    const erreur = demarrerRendu(mpv, vue, this.facteur, taille);
    if (erreur !== null) {
      // La vue seule ne sert à rien : on la retire plutôt que de laisser un
      // rectangle noir par-dessus la page.
      trace(`surface GL : ${erreur}`);
      retirerVueGl(vue);
      this.vue = null;
    }
  }

  /**
   * Rien à caler : le masque de redimensionnement fait suivre la vue, et le
   * rendu relit sa taille à chaque image.
   *
   * L'échelle, elle, change quand la fenêtre passe d'un écran à l'autre — c'est
   * la seule chose à reprendre ici.
   */
  align(): void {
    if (this.vue === null) return;
    this.facteur = echelle(this.host);
  }

  /** Aucune fenêtre à désarmer : il n'y en a plus qu'une. */
  harden(): boolean {
    return this.vue !== null;
  }

  /**
   * Libère le contexte de rendu AVANT que mpv ne s'arrête.
   *
   * ⚠️ L'ordre est impératif : `mpv_render_context_free` attend la fin du rendu
   * en cours, et mpv démonte sa sortie vidéo à l'arrêt. L'inverse ferait
   * s'attendre les deux.
   */
  prearret(): void {
    arreterRendu();
  }

  detach(): void {
    arreterRendu();
    retirerVueGl(this.vue);
    this.vue = null;
  }

  /**
   * La sortie vidéo a-t-elle disparu ?
   *
   * Ici elle disparaît quand NOUS libérons le contexte, ce que `prearret` a
   * déjà fait. L'arrêt n'a donc rien à guetter.
   */
  videoDisparue(): boolean {
    return true;
  }

  /**
   * La fenêtre qui porte la vidéo — la nôtre, désormais.
   *
   * C'est elle que la sonde EDR interroge pour savoir quel écran l'affiche, et
   * c'est correct : la vue vit dedans.
   */
  fenetreVideo(): unknown {
    if (this.vue === null) return null;
    return msg.get(this.vue.vue, "window");
  }

  /**
   * Numéro de fenêtre, pour la capture de pixels.
   *
   * ⚠️ C'est celui de la fenêtre PRINCIPALE : la capture contient donc l'image
   * ET l'overlay, là où le montage à deux fenêtres permettait de capturer la
   * vidéo seule. La sonde reste valable — on cherche à savoir si l'on voit
   * quelque chose —, mais ses chiffres ne sont pas comparables entre montages.
   */
  numeroFenetre(): number {
    return this.vue === null ? 0 : msg.count(this.fenetreVideo(), "windowNumber");
  }

  geometrie(): string {
    if (this.vue === null) return "surface GL non attachee";
    const cadre = msg.rect(this.vue.vue, "frame");
    const b = this.host.getContentBounds();
    const pleinEcran = this.host.isFullScreen()
      ? "natif"
      : this.host.isSimpleFullScreen()
        ? "simple"
        : "non";
    return (
      `montage=vueGL vue=${Math.round(cadre.width)}x${Math.round(cadre.height)} pt ` +
      `echelle=${this.facteur} page=${b.width}x${b.height} ` +
      `images=${String(imagesPresentees())} ${etatRendu()} pleinEcran=${pleinEcran}`
    );
  }
}
