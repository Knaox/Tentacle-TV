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
 * `macosFrame.ts` et `macosFrameConstraint.ts` pour ce qu'il faut à mpv pour accepter
 * la géométrie qu'on lui donne.
 */

import type { BrowserWindow } from "electron";
import { setPlayerSurfaceTransparent } from "../window";
import { neverThrow, trace } from "./native";
import { fromHandle, msg, type Rect } from "./objc";
import { windowGone, watchMpvWindow, mpvLeftovers } from "./macosWindowWatch";
import { attachBelowPage, reorderBelowPage } from "./macosChildWindow";
import { SETTLE_MS, createSeam } from "./macosSeam";
import { watchEdr, forgetEdr } from "./macosEdr";
import { videoLevel, videoTarget, applyFrame } from "./macosFrame";
import { bannerInset } from "../macosTitleBar";
import { describeMontage, stateAtDiscovery } from "./macosSurfaceDiag";
import { AlignClock } from "./macosAlignClock";
import type { VideoSurface } from "./surface";

export class MacosSurface implements VideoSurface {
  /** La `NSWindow` d'Electron, obtenue depuis sa `NSView` racine. */
  private readonly parent: unknown;
  private mpvWindow: unknown = null;
  private search: (() => void) | null = null;
  /** Le recalage par image et la veille — voir `macosAlignClock.ts`. */
  private readonly clock = new AlignClock(() => this.align());
  private attached = false;

  /** Numéro de la fenêtre retenue, pour la reconnaître ensuite. */
  private number = 0;

  /**
   * Le liseré de la fenêtre vidéo — voir `macosSeam.ts`. La cible est une
   * FONCTION, relue quand le geste part : la lecture a pu s'arrêter entre-temps.
   */
  private readonly seam = createSeam(() =>
    this.mpvWindow === null || this.host.isDestroyed()
      ? null
      : { window: this.mpvWindow, fullscreen: this.host.isFullScreen() },
  );

  /** Référence stable — sans elle, `off()` ne retirerait rien. */
  private readonly follow = (): void => this.clock.schedule();

  /**
   * ⚠️ Le plein écran ne se contente PAS d'un recalage : macOS emmène la fenêtre
   * dans un espace dédié et l'ordre n'y survit pas — la vidéo repasse DEVANT et
   * emporte tout l'overlay. On réaffirme donc l'empilement à chaque transition,
   * avant ET après l'animation. La veille couvre le reste.
   */
  private readonly fullscreenTransition = (): void => {
    this.reattach();
    this.clock.schedule();
    // Le liseré une fois qu'AppKit se sera posé ; `schedule` se réarme au besoin.
    this.seam.schedule();
    // Une seconde fois APRÈS l'animation : `enter-full-screen` arrive quand
    // Electron croit la transition finie, mais macOS bouge encore la fenêtre.
    setTimeout(() => {
      if (this.host.isDestroyed()) return;
      this.reattach();
      trace(`plein ecran — ${this.geometrie()}`);
    }, SETTLE_MS);
  };

  constructor(private readonly host: BrowserWindow) {
    this.parent = msg.get(fromHandle(host.getNativeWindowHandle()), "window");
  }

  /**
   * Cherche la fenêtre de mpv jusqu'à la trouver, puis l'attache et la cale. Elle
   * n'existe qu'APRÈS `mpv_initialize`, et de façon asynchrone. `move` est écouté
   * en plus de `resize` : une fenêtre enfant suit son parent, mais le recalage
   * garde la vidéo en place quand on change d'écran.
   */
  attach(): void {
    if (this.attached) return;
    this.attached = true;
    // Relevé AVANT toute recherche : à cet instant, la fenêtre de la lecture qui
    // commence n'existe pas encore, tout ce qu'on voit est donc un vestige.
    const leftovers = mpvLeftovers();
    this.host.on("resize", this.follow);
    this.host.on("move", this.follow);
    // Le plein écran est celui du système : ces deux évènements arrivent, qu'il
    // vienne de nous, du bouton vert ou de Ctrl+Cmd+F.
    this.host.on("enter-full-screen", this.fullscreenTransition);
    this.host.on("leave-full-screen", this.fullscreenTransition);

    this.search = watchMpvWindow(leftovers, (window, number) => {
      this.mpvWindow = window;
      this.number = number;
      this.connect();
    });
  }

  /** Pose la fenêtre trouvée sous la page — voir `macosChildWindow.ts`. */
  private connect(): void {
    // Trace conservée : seule façon de distinguer « mpv n'a pas créé de fenêtre »
    // de « elle existe et nous l'avons attachée ». Sans elle, un écran noir ne se
    // diagnostique plus qu'en instrumentant à la main.
    trace(`fenetre mpv attachee (${this.number})`);
    // AVANT toute intervention — voir `etatALaDecouverte`, qui dit pourquoi cette
    // ligne a tranché ce que rien d'autre ne distinguait.
    trace(`etat a la decouverte — ${stateAtDiscovery(this.mpvWindow)}`);
    this.clock.watch();
    attachBelowPage(this.parent, this.mpvWindow);
    watchEdr(this.mpvWindow, "fenetre video attachee");
    this.align();
    // ⚠️ `addChildWindow:` juste au-dessus provoque l'affichage initial, donc la
    // décision de promotion d'AppKit : le liseré ne se touche pas dans le même
    // tour de boucle. `schedule` s'en charge — c'est le correctif de la 1.21.0.
    this.seam.schedule();
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
  private reattach(): void {
    if (this.mpvWindow === null) return;
    neverThrow("reattachement de la fenetre video", () => {
      reorderBelowPage(this.parent, this.mpvWindow);
      // `poserCadre` et NON `align` : `align` vérifie l'ordre et rappellerait
      // cette fonction — la boucle serait sans fin si l'ordre résistait.
      applyFrame(this.mpvWindow, this.target(), videoLevel(this.host, this.parent));
    });
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
   * est dans `macosFrame.ts`, et le plein écran dans `macosFrameConstraint.ts`.
   */
  align(): void {
    if (this.mpvWindow === null) return;
    // ⚠️ La veille SURVIT à la fenêtre : quitter pendant une lecture détruit la
    // `BrowserWindow` alors que le minuteur est armé, et tout accès à `this.host`
    // lève « Object has been destroyed ». Dans un rappel de minuteur, l'exception
    // est FATALE — Electron ouvre sa boîte « A JavaScript error occurred ».
    if (this.host.isDestroyed()) return this.stopWatchdog();
    // La veille passe ici dix fois par seconde : c'est notre horloge pour dater
    // la décision du compositeur — voir `guetterEdr`.
    watchEdr(this.mpvWindow, "veille");
    // ⚠️ LE LISERÉ N'EST PLUS ICI, et il ne doit pas y revenir : il s'écrivait
    // dix fois par seconde, y compris pendant qu'AppKit déplaçait la fenêtre, ce
    // qui a tué l'application chez un utilisateur (`macosSeam.ts`). Le CALAGE,
    // lui, reste : `setFrame:` et `setLevel:` ne lèvent pas, et macOS déplace la
    // fenêtre sans prévenir.
    neverThrow("calage de la fenetre video", () => {
      applyFrame(this.mpvWindow, this.target(), videoLevel(this.host, this.parent));
    });
  }

  private target(): Rect {
    // Le bandeau d'hôte est peint par la page, et la vidéo doit lui laisser sa
    // place — sinon elle passe DESSOUS, et une bande opaque mange le haut de
    // l'image au lieu de la border. Nul en plein écran, où la page le démonte.
    return videoTarget(this.host, this.parent, bannerInset(this.host));
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
    return describeMontage(this.host, this.parent, this.mpvWindow, this.target());
  }

  /** La fenêtre de mpv, pour la sonde EDR — l'écran qui la porte est celui qui compte. */
  videoWindow(): unknown {
    return this.mpvWindow;
  }

  /** Numéro de la fenêtre vidéo, `0` tant qu'elle n'existe pas. */
  numeroFenetre(): number {
    return this.number;
  }

  /**
   * La fenêtre vidéo a-t-elle disparu ? C'est le témoin qu'attend l'arrêt : tant
   * qu'elle est là, la sortie vidéo vit et demander `quit` figerait le thread
   * principal. On interroge AppKit, jamais mpv.
   */
  videoGone(): boolean {
    return windowGone(this.number);
  }

  detach(): void {
    this.search?.();
    this.search = null;
    this.clock.stop();
    forgetEdr();
    if (this.mpvWindow !== null) {
      neverThrow("detachement de la fenetre video", () => {
        // ⚠️ HORS DE L'ÉCRAN D'ABORD, et ce n'est pas une précaution de style.
        //
        // Cette fenêtre est OPAQUE et NOIRE par construction — c'est elle qui
        // garantit le noir sous une page transparente (`attacherSousLaPage`).
        // Détachée de son parent alors qu'elle vit encore, elle ne le suit plus
        // et ne se recale plus : il reste un rectangle noir grand comme le
        // moniteur, posé par-dessus l'application.
        //
        // L'ordre d'arrêt l'évite déjà — mpv part AVANT le détachement
        // (`ipc/video.ts`) — mais cette attente est BORNÉE à trois secondes, et
        // au-delà on détache quand même. `orderOut:` ferme ce cas-là : la
        // fenêtre quitte l'écran sans être détruite, et mpv la détruira ensuite
        // comme il l'a toujours fait.
        msg.orderOut(this.mpvWindow);
        msg.removeChildWindow(this.parent, this.mpvWindow);
      });
      this.mpvWindow = null;
    }
    this.seam.forget();
    if (this.attached) {
      this.host.off("resize", this.follow);
      this.host.off("move", this.follow);
      this.host.off("enter-full-screen", this.fullscreenTransition);
      this.host.off("leave-full-screen", this.fullscreenTransition);
      this.attached = false;
    }
  }

  /** Désarme la veille et oublie le dernier headroom vu. Idempotent. */
  private stopWatchdog(): void {
    this.clock.stopWatch();
    forgetEdr();
  }
}
