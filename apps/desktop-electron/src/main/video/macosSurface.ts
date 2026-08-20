/**
 * La surface vidéo sur macOS : la fenêtre de mpv, calée sous la nôtre.
 *
 * ⚠️ `--wid` est « currently X11 and Windows only » : le backend qui le lisait
 * sur macOS a été retiré en mpv 0.37. mpv y crée donc TOUJOURS sa propre
 * `NSWindow`, quoi qu'on lui demande, et l'ignorer donne un symptôme connu et
 * trompeur — le son sort, l'image reste noire.
 *
 * On fait l'inverse : on le laisse créer sa fenêtre — c'est même ce qu'on veut,
 * puisqu'elle porte la couche Metal, donc tout le HDR — et on l'attache à la
 * nôtre comme fenêtre enfant, ordonnée EN DESSOUS. macOS la déplace alors avec
 * son parent, et la page se compose par-dessus.
 *
 * Voir `surface.ts` pour ce que ce montage coûte et pourquoi il reste le défaut,
 * `macosFrame.ts` et `macosFullscreen.ts` pour ce qu'il faut à mpv pour accepter
 * la géométrie qu'on lui donne.
 */

import type { BrowserWindow } from "electron";
import { setPlayerSurfaceTransparent } from "../window";
import { sansFaillir, trace } from "./native";
import { depuisHandle, msg, type Rect } from "./objc";
import { fenetreDisparue, guetterFenetreMpv, vestigesMpv } from "./macosGuetFenetre";
import { attacherSousLaPage, cadreSansLisere, reordonnerSousLaPage } from "./macosChildWindow";
import { guetterEdr, oublierEdr } from "./macosEdr";
import { cibleVideo, poserCadre } from "./macosFrame";
import { retraitBandeau } from "../macosTitleBar";
import { decrireMontage, etatALaDecouverte } from "./macosSurfaceDiag";
import type { VideoSurface } from "./surface";

/** Un recalage par image suffit — voir `planifierCalage`. */
const CALAGE_MS = 16;
/**
 * Et une VEILLE : les évènements d'Electron ne suffisent pas.
 *
 * ⚠️ macOS repositionne la fenêtre de mpv de son propre chef, sans qu'aucun
 * `resize`, `move` ni `enter-full-screen` ne parvienne à Electron — mesuré de
 * l'extérieur, 110 ms après un calage parfait. Une réaction aux évènements ne
 * peut PAS l'attraper. Coût : deux lectures de rectangle par tick, en lecture.
 */
const VEILLE_MS = 100;

export class MacosSurface implements VideoSurface {
  /** La `NSWindow` d'Electron, obtenue depuis sa `NSView` racine. */
  private readonly parent: unknown;
  private mpvWindow: unknown = null;
  private recherche: (() => void) | null = null;
  private calage: ReturnType<typeof setTimeout> | null = null;
  private veille: ReturnType<typeof setInterval> | null = null;
  private attache = false;

  /** Numéro de la fenêtre retenue, pour la reconnaître ensuite. */
  private numero = 0;

  /** Référence stable — sans elle, `off()` ne retirerait rien. */
  private readonly suivre = (): void => this.planifierCalage();

  /**
   * ⚠️ Le plein écran ne se contente PAS d'un recalage : macOS emmène la fenêtre
   * dans un espace dédié et l'ordre n'y survit pas — la vidéo repasse DEVANT et
   * emporte tout l'overlay. On réaffirme donc l'empilement à chaque transition,
   * avant ET après l'animation. La veille couvre le reste.
   */
  private readonly transitionPleinEcran = (): void => {
    this.reattacher();
    this.planifierCalage();
    // Une seconde fois APRÈS l'animation : `enter-full-screen` arrive quand
    // Electron croit la transition finie, mais macOS bouge encore la fenêtre.
    setTimeout(() => {
      if (this.host.isDestroyed()) return;
      this.reattacher();
      trace(`plein ecran — ${this.geometrie()}`);
    }, 500);
  };

  constructor(private readonly host: BrowserWindow) {
    this.parent = msg.get(depuisHandle(host.getNativeWindowHandle()), "window");
  }

  /**
   * Cherche la fenêtre de mpv jusqu'à la trouver, puis l'attache et la cale. Elle
   * n'existe qu'APRÈS `mpv_initialize`, et de façon asynchrone. `move` est écouté
   * en plus de `resize` : une fenêtre enfant suit son parent, mais le recalage
   * garde la vidéo en place quand on change d'écran.
   */
  attach(): void {
    if (this.attache) return;
    this.attache = true;
    // Relevé AVANT toute recherche : à cet instant, la fenêtre de la lecture qui
    // commence n'existe pas encore, tout ce qu'on voit est donc un vestige.
    const vestiges = vestigesMpv();
    this.host.on("resize", this.suivre);
    this.host.on("move", this.suivre);
    // Le plein écran est celui du système : ces deux évènements arrivent, qu'il
    // vienne de nous, du bouton vert ou de Ctrl+Cmd+F.
    this.host.on("enter-full-screen", this.transitionPleinEcran);
    this.host.on("leave-full-screen", this.transitionPleinEcran);

    this.recherche = guetterFenetreMpv(vestiges, (fenetre, numero) => {
      this.mpvWindow = fenetre;
      this.numero = numero;
      this.brancher();
    });
  }

  /** Pose la fenêtre trouvée sous la page — voir `macosChildWindow.ts`. */
  private brancher(): void {
    // Trace conservée : seule façon de distinguer « mpv n'a pas créé de fenêtre »
    // de « elle existe et nous l'avons attachée ». Sans elle, un écran noir ne se
    // diagnostique plus qu'en instrumentant à la main.
    trace(`fenetre mpv attachee (${this.numero})`);
    // AVANT toute intervention — voir `etatALaDecouverte`, qui dit pourquoi cette
    // ligne a tranché ce que rien d'autre ne distinguait.
    trace(`etat a la decouverte — ${etatALaDecouverte(this.mpvWindow)}`);
    // La veille ne démarre qu'ICI : tant que la fenêtre n'existe pas, il n'y a
    // rien à surveiller, et elle s'arrête avec la lecture (`detach`).
    if (this.veille === null) this.veille = setInterval(() => this.align(), VEILLE_MS);
    attacherSousLaPage(this.parent, this.mpvWindow);
    guetterEdr(this.mpvWindow, "fenetre video attachee");
    this.align();
    // ⚠️ La transparence se pose ICI, et pas une milliseconde plus tôt.
    //
    // La page la demandait dès que `mpv_initialize` avait rendu la main
    // (`useMpvLifecycle.ts`). Or sur macOS mpv ne crée sa fenêtre qu'au premier
    // `loadfile` — c'est `force-window=no`, et il n'est pas négociable : avec
    // `yes`, la couche Metal naît en SRGB et le compositeur refuse le headroom
    // pour toute la lecture. Il y avait donc un intervalle, celui de l'ouverture
    // du flux, où la page ne peignait plus rien et où mpv n'avait rien à
    // montrer : on voyait le BUREAU au travers. C'est le clignotement
    // « image → transparent → image » constaté à chaque ouverture de film.
    //
    // Le processus principal est le seul à savoir quand la vidéo est réellement
    // là, puisque c'est lui qui guette la fenêtre pour l'attacher. Et si elle
    // n'arrive jamais, la surface reste opaque : l'utilisateur voit l'interface
    // du lecteur plutôt que son bureau.
    setPlayerSurfaceTransparent(true);
  }

  /** Remet la vidéo sous la page — voir `macosChildWindow.ts`. */
  private reattacher(): void {
    if (this.mpvWindow === null) return;
    sansFaillir("reattachement de la fenetre video", () => {
      reordonnerSousLaPage(this.parent, this.mpvWindow);
      // `poserCadre` et NON `align` : `align` vérifie l'ordre et rappellerait
      // cette fonction — la boucle serait sans fin si l'ordre résistait.
      poserCadre(this.mpvWindow, this.cible(), this.niveauVideo());
    });
  }

  /**
   * Le niveau où poser la vidéo : celui de la page, ou UN DE MOINS en plein écran.
   *
   * ⚠️ Dans un espace de plein écran, le serveur de fenêtres place la fille
   * DEVANT son parent quoi que dise `addChildWindow:ordered:NSWindowBelow` —
   * relevé par CoreGraphics, mpv au rang 6 et la page au rang 7, tout l'overlay
   * masqué. Les NIVEAUX, eux, sont respectés partout. Un seul cran, et seulement
   * là : plus bas, ou en fenêtré, la vidéo passerait aussi sous les fenêtres des
   * AUTRES applications. Toute l'histoire est dans `fullscreen.ts`.
   */
  private niveauVideo(): number {
    const page = msg.entier(this.parent, "level");
    return this.host.isFullScreen() || this.host.isSimpleFullScreen() ? page - 1 : page;
  }

  /**
   * Cale la fenêtre vidéo sur le rectangle que couvre la page.
   *
   * On reste en coordonnées AppKit — origine en bas à gauche — en lisant le cadre
   * du parent : passer par celles d'Electron obligerait à retourner l'axe vertical
   * en devinant la hauteur de l'écran, et se tromperait au second moniteur.
   *
   * ⚠️ Le calage passe par `poserCadre`, JAMAIS par `setFrame:` : mpv redéfinit
   * `constrainFrameRect:toScreen:` et corrige ce qu'on demande. Toute l'histoire
   * est dans `macosFrame.ts`, et le plein écran dans `macosFullscreen.ts`.
   */
  align(): void {
    if (this.mpvWindow === null) return;
    // ⚠️ La veille SURVIT à la fenêtre : quitter pendant une lecture détruit la
    // `BrowserWindow` alors que le minuteur est armé, et tout accès à `this.host`
    // lève « Object has been destroyed ». Dans un rappel de minuteur, l'exception
    // est FATALE — Electron ouvre sa boîte « A JavaScript error occurred ».
    if (this.host.isDestroyed()) return this.stopVeille();
    // La veille passe ici dix fois par seconde : c'est notre horloge pour dater
    // la décision du compositeur — voir `guetterEdr`.
    guetterEdr(this.mpvWindow, "veille");
    cadreSansLisere(this.mpvWindow, this.host.isFullScreen());
    sansFaillir("calage de la fenetre video", () => {
      poserCadre(this.mpvWindow, this.cible(), this.niveauVideo());
    });
  }

  private cible(): Rect {
    // Le bandeau d'hôte est peint par la page, et la vidéo doit lui laisser sa
    // place — sinon elle passe DESSOUS, et une bande opaque mange le haut de
    // l'image au lieu de la border. Nul en plein écran, où la page le démonte.
    return cibleVideo(this.host, this.parent, retraitBandeau(this.host));
  }

  /**
   * Le désarmement a déjà eu lieu dans `brancher`, dès que la fenêtre existe.
   * Rend donc simplement l'état : `false` tant que mpv n'a pas créé sa fenêtre.
   * La page appelle cette commande juste après `mpv_init`, quelques
   * millisecondes trop tôt — c'est un rappel, jamais une garantie.
   */
  harden(): boolean {
    return this.mpvWindow !== null;
  }

  /** L'état du montage, pour le rapport — voir `macosSurfaceDiag.ts`. */
  geometrie(): string {
    if (this.mpvWindow === null) return "surface non attachee";
    return decrireMontage(this.host, this.parent, this.mpvWindow, this.cible());
  }

  /** La fenêtre de mpv, pour la sonde EDR — l'écran qui la porte est celui qui compte. */
  fenetreVideo(): unknown {
    return this.mpvWindow;
  }

  /** Numéro de la fenêtre vidéo, `0` tant qu'elle n'existe pas. */
  numeroFenetre(): number {
    return this.numero;
  }

  /**
   * La fenêtre vidéo a-t-elle disparu ? C'est le témoin qu'attend l'arrêt : tant
   * qu'elle est là, la sortie vidéo vit et demander `quit` figerait le thread
   * principal. On interroge AppKit, jamais mpv.
   */
  videoDisparue(): boolean {
    return fenetreDisparue(this.numero);
  }

  detach(): void {
    this.stopSearch();
    if (this.calage !== null) clearTimeout(this.calage);
    this.calage = null;
    this.stopVeille();
    if (this.mpvWindow !== null) {
      sansFaillir("detachement de la fenetre video", () => {
        msg.removeChildWindow(this.parent, this.mpvWindow);
      });
      this.mpvWindow = null;
    }
    if (this.attache) {
      this.host.off("resize", this.suivre);
      this.host.off("move", this.suivre);
      this.host.off("enter-full-screen", this.transitionPleinEcran);
      this.host.off("leave-full-screen", this.transitionPleinEcran);
      this.attache = false;
    }
  }

  /**
   * Un recalage par image, pas un par évènement : attraper un bord de fenêtre à
   * la souris tire des dizaines de `resize` par seconde. Front descendant — le
   * premier évènement arme le minuteur, les suivants sont absorbés, et le calage
   * a lieu juste après le dernier.
   */
  private planifierCalage(): void {
    if (this.calage !== null) return;
    this.calage = setTimeout(() => {
      this.calage = null;
      this.align();
    }, CALAGE_MS);
  }

  /** Désarme la veille et oublie le dernier headroom vu. Idempotent. */
  private stopVeille(): void {
    if (this.veille !== null) clearInterval(this.veille);
    this.veille = null;
    oublierEdr();
  }

  private stopSearch(): void {
    this.recherche?.();
    this.recherche = null;
  }
}
