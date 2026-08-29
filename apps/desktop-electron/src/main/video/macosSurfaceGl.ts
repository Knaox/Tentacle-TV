/**
 * La surface vidéo macOS par la Render API : une vue, dans notre fenêtre.
 *
 * Tient le même contrat que `MacosSurface` — s'attacher, suivre la géométrie,
 * se détacher — mais sans seconde fenêtre. La vue OpenGL vit dans la fenêtre
 * d'Electron, sous le contenu web, et suit ses dimensions toute seule
 * (`macosGlView.ts`) ; mpv y dessine image par image (`macosRenderMpv.ts`).
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
import { handle } from "./mpv";
import { createGlView, scale, removeGlView, sizeInPixels, type GlView } from "./macosGlView";
import { stopRender, startRender, renderState, framesPresented } from "./macosRenderMpv";
import type { VideoSurface } from "./surface";

export class MacosSurfaceGl implements VideoSurface {
  private view: GlView | null = null;
  private factor = 1;

  constructor(private readonly host: BrowserWindow) {}

  /**
   * Crée la vue et lance le rendu.
   *
   * ⚠️ Appelée APRÈS `mpv_initialize` : le contexte de rendu ne peut être créé
   * que sur une instance déjà initialisée, et mpv doit déjà savoir qu'il rend
   * dans `vo=libmpv`.
   */
  attach(): void {
    if (this.view !== null) return;

    const mpv = handle();
    if (!mpv) {
      trace("surface GL : mpv n'est pas demarre, rien a attacher");
      return;
    }

    const view = createGlView(this.host);
    if (view === null) return;

    this.view = view;
    this.factor = scale(this.host);
    const size = sizeInPixels(view.view, this.factor);
    const error = startRender(mpv, view, this.factor, size);
    if (error !== null) {
      // La vue seule ne sert à rien : on la retire plutôt que de laisser un
      // rectangle noir par-dessus la page.
      trace(`surface GL : ${error}`);
      removeGlView(view);
      this.view = null;
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
    if (this.view === null) return;
    this.factor = scale(this.host);
  }

  /** Aucune fenêtre à désarmer : il n'y en a plus qu'une. */
  harden(): boolean {
    return this.view !== null;
  }

  /**
   * Libère le contexte de rendu AVANT que mpv ne s'arrête.
   *
   * ⚠️ L'ordre est impératif : `mpv_render_context_free` attend la fin du rendu
   * en cours, et mpv démonte sa sortie vidéo à l'arrêt. L'inverse ferait
   * s'attendre les deux.
   */
  preStop(): void {
    stopRender();
  }

  detach(): void {
    stopRender();
    removeGlView(this.view);
    this.view = null;
  }

  /**
   * La sortie vidéo a-t-elle disparu ?
   *
   * Ici elle disparaît quand NOUS libérons le contexte, ce que `prearret` a
   * déjà fait. L'arrêt n'a donc rien à guetter.
   */
  videoGone(): boolean {
    return true;
  }

  /**
   * La fenêtre qui porte la vidéo — la nôtre, désormais.
   *
   * C'est elle que la sonde EDR interroge pour savoir quel écran l'affiche, et
   * c'est correct : la vue vit dedans.
   */
  videoWindow(): unknown {
    if (this.view === null) return null;
    return msg.get(this.view.view, "window");
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
    return this.view === null ? 0 : msg.count(this.videoWindow(), "windowNumber");
  }

  geometrie(): string {
    if (this.view === null) return "surface GL non attachee";
    const frame = msg.rect(this.view.view, "frame");
    const b = this.host.getContentBounds();
    const fullscreen = this.host.isFullScreen()
      ? "natif"
      : this.host.isSimpleFullScreen()
        ? "simple"
        : "non";
    return (
      `montage=vueGL vue=${Math.round(frame.width)}x${Math.round(frame.height)} pt ` +
      `echelle=${this.factor} page=${b.width}x${b.height} ` +
      `images=${String(framesPresented())} ${renderState()} pleinEcran=${fullscreen}`
    );
  }
}
