/**
 * La surface vidéo sur macOS : la fenêtre de mpv, calée sous la nôtre.
 *
 * # Pourquoi ce montage, et pas celui de Windows
 *
 * Sous Windows, mpv reçoit `--wid` — le HWND de la fenêtre Electron — et crée
 * une fenêtre ENFANT à l'intérieur ; il suffit de la pousser au fond et de
 * rendre la surface de Chromium transparente (voir `videoWindow.ts`).
 *
 * ⚠️ **Sur macOS ce chemin n'existe plus.** Le backend qui lisait `--wid` était
 * le backend OpenGL cocoa, déprécié en mpv 0.29 et RETIRÉ en 0.37 ; le backend
 * actuel (`video/out/mac/`) ne consulte jamais l'identifiant fourni. mpv crée
 * donc toujours sa propre `NSWindow`, quoi qu'on lui demande. Le symptôme, quand
 * on l'ignore, est connu et trompeur : **le son sort, l'image reste noire**.
 *
 * On fait donc l'inverse : on laisse mpv créer sa fenêtre — c'est même ce qu'on
 * VEUT, puisque c'est elle qui porte la couche Metal capable de plage étendue,
 * donc tout le HDR — et on l'attache à la nôtre comme fenêtre enfant, ordonnée
 * EN DESSOUS. macOS la déplace alors avec son parent, et la vue HTML se compose
 * par-dessus.
 *
 * Établi en phase 1, sur proto isolé.
 */

import type { BrowserWindow } from "electron";
import { sansFaillir, trace } from "./native";
import {
  NSWindowBelow,
  depuisHandle,
  fenetresApp,
  msg,
  numeroFenetre,
  numerosFenetres,
  trouverFenetreNeuve,
  type Rect,
} from "./objc";
import type { VideoSurface } from "./surface";

/** Cadence du sondage, et nombre maximal de tentatives (10 s en tout). */
const SONDAGE_MS = 100;
const SONDAGES_MAX = 100;
/** Un recalage par image suffit — voir `planifierCalage`. */
const CALAGE_MS = 16;

/**
 * Classe de la fenêtre créée par mpv.
 *
 * `Window` de `video/out/mac/window.swift` ; le préfixe de module la fait
 * apparaître comme `swift.Window` à l'exécution. Vérifié sur mpv 0.41.0.
 */
const CLASSE_FENETRE_MPV = "swift.Window";

export class MacosSurface implements VideoSurface {
  /** La `NSWindow` d'Electron, obtenue depuis sa `NSView` racine. */
  private readonly parent: unknown;
  private mpvWindow: unknown = null;
  private recherche: ReturnType<typeof setInterval> | null = null;
  private calage: ReturnType<typeof setTimeout> | null = null;
  private attache = false;

  /**
   * Les fenêtres mpv déjà présentes quand cette surface a commencé à chercher.
   *
   * Tout ce qui est là-dedans est un VESTIGE de la lecture précédente : le cœur
   * de mpv se termine sur ses propres threads, après que la commande d'arrêt a
   * rendu la main, et sa fenêtre survit quelques instants. Sans cette mémoire,
   * le changement d'épisode cale la vidéo sur une fenêtre morte.
   */
  private vestiges: ReadonlySet<number> = new Set();
  /** Numéro de la fenêtre retenue, pour la reconnaître ensuite. */
  private numero = 0;

  /** Référence stable — sans elle, `off()` ne retirerait rien. */
  private readonly suivre = (): void => this.planifierCalage();

  constructor(private readonly host: BrowserWindow) {
    this.parent = msg.get(depuisHandle(host.getNativeWindowHandle()), "window");
  }

  /**
   * Cherche la fenêtre de mpv jusqu'à la trouver, puis l'attache et la cale.
   *
   * Elle n'existe qu'APRÈS `mpv_initialize`, et de façon asynchrone : il faut la
   * chercher à plusieurs reprises. `move` est écouté en plus de `resize` — une
   * fenêtre enfant suit son parent, mais le recalage garde la vidéo sur le
   * rectangle de contenu quand l'utilisateur change d'écran.
   */
  attach(): void {
    if (this.attache) return;
    this.attache = true;
    // Relevé AVANT toute recherche : à cet instant, la fenêtre de la lecture
    // qui commence n'existe pas encore. Tout ce qu'on voit est donc un vestige.
    this.vestiges = numerosFenetres(CLASSE_FENETRE_MPV);
    this.host.on("resize", this.suivre);
    this.host.on("move", this.suivre);
    this.host.on("enter-full-screen", this.suivre);
    this.host.on("leave-full-screen", this.suivre);

    let essais = 0;
    this.recherche = setInterval(() => {
      sansFaillir("recherche de la fenetre mpv", () => {
        const trouvee = trouverFenetreNeuve(CLASSE_FENETRE_MPV, this.vestiges);
        if (trouvee !== null) {
          this.stopSearch();
          this.mpvWindow = trouvee;
          this.numero = numeroFenetre(trouvee);
          this.brancher();
          return;
        }
        essais += 1;
        // Rien n'est tracé pendant la recherche : elle aboutit en une poignée
        // de sondages, et un point de situation toutes les deux secondes noyait
        // le journal pour ne rien dire. L'ÉCHEC, lui, est tracé avec la liste
        // des fenêtres — « mpv n'a créé aucune fenêtre » et « elle existe mais
        // nous échappe » demandent des corrections opposées, et rien ne les
        // distingue après coup.
        if (essais > SONDAGES_MAX) {
          this.stopSearch();
          trace(`fenetre mpv introuvable apres 10 s — ${fenetresApp()}`);
        }
      });
    }, SONDAGE_MS);
  }

  /**
   * Attache la fenêtre de mpv sous la nôtre, et la désarme.
   *
   * `NSWindowBelow` est le cœur du montage : sans lui la fenêtre de mpv passe
   * DEVANT et masque toute l'interface. `ignoresMouseEvents` est une ceinture de
   * sécurité — déjà couverte par celle du dessus, mais un décalage d'un pixel
   * suffirait à lui faire attraper un clic. L'ombre portée est retirée : une
   * fenêtre enfant exactement superposée en dessinerait une au ras du cadre.
   */
  private brancher(): void {
    msg.setFlag(this.mpvWindow, "setIgnoresMouseEvents:", true);
    msg.setFlag(this.mpvWindow, "setHasShadow:", false);
    msg.addChildWindow(this.parent, this.mpvWindow, NSWindowBelow);
    this.align();
  }

  /**
   * Cale la fenêtre vidéo sur le rectangle de CONTENU de la nôtre.
   *
   * On reste de bout en bout en coordonnées AppKit — origine en bas à gauche —
   * en lisant le cadre du parent et en le convertissant sur place. Passer par
   * les coordonnées d'Electron obligerait à retourner l'axe vertical en devinant
   * la hauteur de l'écran, et se tromperait dès le second moniteur.
   */
  align(): void {
    if (this.mpvWindow === null) return;
    sansFaillir("calage de la fenetre video", () => {
      const cadre: Rect = msg.rect(this.parent, "frame");
      const contenu: Rect = msg.contentRect(this.parent, cadre);
      msg.setFrame(this.mpvWindow, contenu);
    });
  }

  /**
   * Le désarmement a déjà eu lieu dans `brancher`, dès que la fenêtre existe.
   *
   * Rend donc simplement l'état : `false` tant que mpv n'a pas créé sa fenêtre.
   * La page appelle cette commande juste après `mpv_init`, quelques
   * millisecondes trop tôt — c'est un rappel, jamais une garantie.
   */
  harden(): boolean {
    return this.mpvWindow !== null;
  }

  /**
   * L'état géométrique des deux fenêtres, pour juger le montage sans le voir.
   *
   * Une capture d'écran demande une autorisation système qu'on n'a pas toujours ;
   * ces quatre nombres, eux, disent objectivement si la vidéo occupe la bonne
   * surface. Un écart en `y` trahit une confusion entre le cadre de la fenêtre
   * et son rectangle de contenu — la barre de titre fait vingt-huit points, et
   * la vidéo sortirait par le bas.
   */
  geometrie(): string {
    if (this.mpvWindow === null) return "surface non attachee";
    const parent: Rect = msg.contentRect(this.parent, msg.rect(this.parent, "frame"));
    const video: Rect = msg.rect(this.mpvWindow, "frame");
    const colle =
      Math.abs(parent.x - video.x) < 1 &&
      Math.abs(parent.y - video.y) < 1 &&
      Math.abs(parent.width - video.width) < 1 &&
      Math.abs(parent.height - video.height) < 1;
    const enfant = msg.get(this.mpvWindow, "parentWindow") !== null;
    const visible = msg.bool(this.mpvWindow, "isVisible");
    return (
      `contenu=${fmt(parent)} video=${fmt(video)} ` +
      `calee=${colle ? "oui" : "NON"} enfant=${enfant ? "oui" : "NON"} ` +
      `visible=${visible ? "oui" : "NON"}`
    );
  }

  /** La fenêtre de mpv, pour la sonde EDR — l'écran qui la porte est celui qui compte. */
  fenetreVideo(): unknown {
    return this.mpvWindow;
  }

  /**
   * La fenêtre vidéo a-t-elle disparu de l'application ?
   *
   * C'est le témoin qu'attend la séquence d'arrêt : tant qu'elle est là, la
   * sortie vidéo vit, et demander `quit` figerait le thread principal. On
   * interroge AppKit, jamais mpv — lire une propriété de la sortie vidéo depuis
   * ce thread est précisément ce qui bloque (voir `objc.ts`).
   */
  videoDisparue(): boolean {
    if (this.numero === 0) return true;
    return !numerosFenetres(CLASSE_FENETRE_MPV).has(this.numero);
  }

  detach(): void {
    this.stopSearch();
    if (this.calage !== null) clearTimeout(this.calage);
    this.calage = null;
    if (this.mpvWindow !== null) {
      sansFaillir("detachement de la fenetre video", () => {
        msg.removeChildWindow(this.parent, this.mpvWindow);
      });
      this.mpvWindow = null;
    }
    if (this.attache) {
      this.host.off("resize", this.suivre);
      this.host.off("move", this.suivre);
      this.host.off("enter-full-screen", this.suivre);
      this.host.off("leave-full-screen", this.suivre);
      this.attache = false;
    }
  }

  /**
   * Un recalage par image, pas un par évènement.
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

/** Un rectangle, en une lecture. */
function fmt(r: Rect): string {
  return `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}`;
}
