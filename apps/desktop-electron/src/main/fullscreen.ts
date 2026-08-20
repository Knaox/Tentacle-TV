/**
 * Plein écran SANS le plein écran natif de Windows.
 *
 * # Pourquoi ne pas appeler `setFullScreen`
 *
 * Parce qu'il casse la lecture. En plein écran natif, la vidéo disparaissait —
 * écran noir — et l'interface se couvrait de traînées, le bureau transparaissant
 * par endroits. Le retour en fenêtré remettait tout d'aplomb, et rester en
 * fenêtré n'a jamais posé le moindre problème.
 *
 * Chromium désactive la transparence d'une fenêtre qu'il tient pour plein écran
 * (electron#2184, #8439, #27286). Notre surface redevient alors opaque, la
 * fenêtre de mpv placée dessous est masquée, il ne reste que du noir.
 *
 * L'app Tauri, elle, fait un plein écran natif sans problème : sa transparence
 * est portée par une fenêtre FILLE (WebView2), et non par la fenêtre que Windows
 * met en plein écran. Electron n'offre pas ce partage — ses vues sont composées
 * dans la même surface, pas dans des fenêtres séparées.
 *
 * Écarté avant d'en arriver là, tout mesuré à l'écran : désactiver
 * `CalculateNativeWinOcclusion` et `EnableTransparentHwndEnlargement` (sans
 * effet), et rendre la fenêtre 2 px plus grande puis plus petite que l'écran
 * (sans effet non plus — ces essais gardaient `setFullScreen(true)`, donc
 * Chromium se savait toujours en plein écran).
 *
 * # Ce qu'on fait à la place
 *
 * La fenêtre reste à l'état NORMAL : on lui retire son cadre, on la pose sur
 * toute la surface de l'écran, et on rend l'un et l'autre en sortant.
 * L'utilisateur ne voit aucune différence ; Chromium ne se croit jamais en plein
 * écran. C'est aussi ce que font beaucoup de lecteurs, par choix.
 */

import { screen, type BrowserWindow, type Rectangle } from "electron";
import { nativeHandle } from "./video/native";

/**
 * Tout ce qui précède décrit un contournement STRICTEMENT Windows.
 *
 * macOS a le sien, pour une raison différente — voir `PLEIN_ECRAN_NATIF`.
 */
const PARADE_WINDOWS = process.platform === "win32";

/**
 * Sur macOS : le plein écran du SYSTÈME, avec son espace dédié.
 *
 * C'est le seul que les utilisateurs de Mac reconnaissent, et le plein écran
 * simple — celui d'avant Lion, qui pose la fenêtre par-dessus le bureau courant
 * — a été écarté pour cette raison.
 *
 * # Ce qu'il a fallu pour que l'espace dédié tienne
 *
 * ⚠️ Le serveur de fenêtres y place la fenêtre fille DEVANT son parent, quoi que
 * dise `addChildWindow:ordered:NSWindowBelow`. Relevé par CoreGraphics, lecture
 * en cours, avant correction : mpv au rang 6, la page au rang 7 — et tout
 * l'overlay disparaissait. Pire, AppKit l'ignorait : `[NSApp orderedWindows]`
 * plaçait la vidéo DERRIÈRE au même instant. Les deux modèles divergent.
 *
 * Ce qui le règle est le NIVEAU, pas l'ordre de filiation : la fenêtre vidéo est
 * posée un niveau SOUS la nôtre le temps du plein écran (`video/macosSurface.ts`).
 * Le serveur de fenêtres respecte les niveaux, lui, et dans tous les espaces.
 *
 * # Et ce que l'espace dédié fait gagner au passage
 *
 * La fenêtre y mesure exactement le `visibleFrame` — 1512x949 sur un Mac à
 * encoche — au lieu de déborder sur les 33 points de la barre de menus. La
 * contrainte que mpv impose au cadre de sa fenêtre ne mord donc plus, et tout le
 * détour qui la désarmait a pu être retiré.
 */
const PLEIN_ECRAN_NATIF = process.platform === "darwin";

/** Les appels Win32 de la parade, réclamés seulement là où ils existent. */
function win32(): typeof import("./video/win32") {
  return require("./video/win32") as typeof import("./video/win32");
}

/**
 * État d'avant le plein écran, à rendre tel quel. `null` = fenêtré.
 *
 * `maximisee` est mémorisé à part : une fenêtre agrandie doit être rendue à son
 * ÉTAT, pas à sa géométrie. Reposer ses seuls bounds donnerait une fenêtre qui
 * a l'air agrandie sans l'être — bouton « restaurer » inversé, double-clic sur
 * la barre de titre incohérent.
 *
 * `normales` est la géométrie que Windows rendra le jour où l'utilisateur
 * restaurera la fenêtre. Le plein écran l'ÉCRASE — `unmaximize` puis un
 * redimensionnement à la taille de l'écran la remplacent par cette taille-là —
 * et sans elle, sortir du plein écran d'une fenêtre agrandie puis la restaurer
 * donnait une fenêtre grande comme l'écran. Mesuré : `460x241` devenait
 * `1920x1106`.
 */
let avant: { normales: Rectangle; style: bigint; maximisee: boolean } | null = null;

/**
 * La fenêtre servie en dernier, pour interroger macOS à la source.
 *
 * Sur macOS l'état n'est pas à nous : l'utilisateur peut entrer et sortir du
 * plein écran par le bouton vert ou par Ctrl+Cmd+F, sans passer par nous. Une
 * mémoire locale mentirait dès le premier de ces gestes ; on lit donc la
 * fenêtre à chaque question.
 */
let hote: BrowserWindow | null = null;

export function estEnPleinEcran(): boolean {
  if (PARADE_WINDOWS) return avant !== null;
  if (hote === null || hote.isDestroyed()) return false;
  // Le SIMPLE est encore interrogé : il n'est plus posé par nous, mais une
  // session ouverte avant une mise à jour peut encore s'y trouver, et une
  // fenêtre dont on ne sait pas qu'elle est en plein écran est une souricière.
  return hote.isFullScreen() || hote.isSimpleFullScreen();
}

/**
 * L'ordre compte : le cadre part d'abord, la géométrie ensuite. L'inverse
 * poserait la fenêtre à la taille de l'écran AVEC son cadre, et la zone client
 * serait alors trop petite — un liseré de bureau le temps d'une image.
 */
/**
 * Deux mesures existent, et une seule compte.
 *
 * `GetClientRect` (Win32) est ce que `calerSous` donne à mpv, donc ce qui
 * décide des bandes noires. `getContentBounds()` d'Electron est la vision de
 * Chromium, qui réserve une hauteur de barre de titre même quand le style
 * Win32 n'en a plus — les deux DIVERGENT, et se fier à la seconde conduit à
 * corriger un écart qui n'existe pas.
 *
 * Mesuré sur un écran 3840x2160 px, après `unmaximize` puis retrait du cadre :
 *
 *   setBounds         GetClientRect 3840x2160  fenêtre 3840x2160 @ 0,0
 *   setContentBounds  GetClientRect 3840x2212  fenêtre 3840x2212 @ 0,-52
 *
 * `setBounds` donne donc déjà une zone client pleine. `setContentBounds`, lui,
 * fait déborder la fenêtre de 52 px vers le haut — et Windows ne masque la
 * barre des tâches que pour une fenêtre couvrant EXACTEMENT le moniteur.
 */
function entrer(win: BrowserWindow): void {
  if (avant !== null) return;

  // macOS : le plein écran du système, avec son espace dédié — voir
  // `PLEIN_ECRAN_NATIF`. `avant` reste `null` : c'est la fenêtre elle-même qui
  // porte l'état, et `estEnPleinEcran` le lui demande.
  if (!PARADE_WINDOWS) {
    hote = win;
    if (PLEIN_ECRAN_NATIF) win.setFullScreen(true);
    // ⚠️ NON VÉRIFIÉ, et assumé comme tel. Une fenêtre qui vient de changer
    // d'espace peut ne plus être la fenêtre CLÉ, et AppKit ne livre pas
    // `mouseMoved:` à une fenêtre qui ne l'est pas — c'est la cause la plus
    // probable du symptôme signalé, où il fallait CLIQUER pour réveiller les
    // contrôles au lieu de bouger la souris. Le reproduire demanderait de poster
    // de vrais évènements de souris, donc l'accès d'assistance : la correction
    // repose sur un raisonnement, pas sur une mesure. Elle ne coûte rien.
    win.focus();
    return;
  }

  const maximisee = win.isMaximized();
  // Capturés AVANT `unmaximize`, et pour deux usages distincts : `bounds` dit
  // où la fenêtre se trouve pour l'utilisateur, donc sur quel écran ouvrir ;
  // `normales` est la géométrie de restauration, que la suite va écraser.
  const bounds = win.getBounds();
  const normales = win.getNormalBounds();

  // 1. Lever l'état agrandi D'ABORD. Windows contraint la géométrie tant qu'il
  //    dure, et Chromium recalcule sa zone non-cliente avec les marges
  //    d'agrandissement — d'où les 12 DIP de largeur perdus quand on le laisse.
  //    L'état est rendu en sortant, c'est `maximisee` qui le porte.
  if (maximisee) win.unmaximize();

  // 2. Retirer le cadre ensuite : posé avant, `unmaximize` le défait.
  const style = win32().retirerLeCadre(nativeHandle(win));
  avant = { normales, style, maximisee };

  // 3. `setBounds` et NON `setContentBounds` : voir l'en-tête de la fonction.
  //    La fenêtre doit couvrir exactement le moniteur — c'est à cette
  //    condition, et à elle seule, que Windows masque la barre des tâches.
  //
  // `getDisplayMatching` et NON `getDisplayNearestPoint` : le second attend un
  // POINT et ne lit que le coin supérieur gauche — or Windows fait déborder une
  // fenêtre agrandie de quelques pixels, et ce coin tombe alors dans l'écran
  // VOISIN. Mesuré sur un poste à trois écrans : agrandie sur l'écran principal
  // (0,0), `getBounds()` rend `x=-7 y=-7`, et l'écran de gauche commence à
  // `x=-1152`. Le plein écran partait chez lui.
  //
  // `bounds` et non `workArea` : la barre des tâches doit être recouverte.
  win.setBounds(screen.getDisplayMatching(bounds).bounds);
}

function sortir(win: BrowserWindow): void {
  if (!PARADE_WINDOWS) {
    hote = win;
    // Les deux, dans cet ordre : une session ouverte avant la bascule vers le
    // natif peut encore être en plein écran simple, et la touche Échap doit
    // rendre la main dans les deux cas.
    if (win.isSimpleFullScreen()) win.setSimpleFullScreen(false);
    if (win.isFullScreen()) win.setFullScreen(false);
    return;
  }

  const memoire = avant;
  if (memoire === null) return;
  avant = null;
  win32().rendreLeCadre(nativeHandle(win), memoire.style);
  // La géométrie normale D'ABORD, agrandissement ensuite. C'est elle que
  // Windows retiendra comme taille de restauration ; la reposer seulement
  // quand la fenêtre était fenêtrée laisserait une fenêtre agrandie rendre la
  // taille de l'écran au premier clic sur « restaurer ».
  win.setBounds(memoire.normales);
  if (memoire.maximisee) win.maximize();
}

/**
 * Session plein écran du lecteur : dans quel mode la fenêtre était-elle quand la
 * vidéo a commencé ? `null` = aucune session ouverte.
 *
 * C'est toute la question à laquelle il faut répondre pour rendre la fenêtre au
 * mode qui était le sien : le plein écran d'un film n'appartient pas au même que
 * celui d'un utilisateur qui parcourt son catalogue en plein écran.
 *
 * `maximisee` est mémorisé à part, et pour macOS : le plein écran fenêtré — la
 * fenêtre ZOOMÉE — est un troisième état, ni fenêtré ni plein écran, et le
 * rendre demande de le connaître. Windows, lui, le tient déjà dans `avant`.
 */
let sessionLecteur: { dejaEnPleinEcran: boolean; maximisee: boolean } | null = null;

/**
 * Ouvre la session, et rend l'état COURANT du plein écran.
 *
 * ⚠️ Ouverte UNE SEULE FOIS, et c'est le point délicat. Un changement d'épisode
 * remonte le lecteur (`key={itemId}`) alors que la fenêtre, elle, reste en plein
 * écran : relire son état à ce moment-là ferait conclure que le plein écran était
 * celui de l'utilisateur, et la fenêtre ne redescendrait plus jamais.
 *
 * La fenêtre est passée en argument plutôt que déduite de `hote` : celui-ci
 * n'est posé que par NOS bascules, et une fenêtre mise en plein écran au bouton
 * vert avant même d'ouvrir un film y aurait été comptée pour fenêtrée.
 */
export function ouvrirSessionLecteur(win: BrowserWindow): boolean {
  if (!PARADE_WINDOWS) hote = win;
  const enPleinEcran = estEnPleinEcran();
  sessionLecteur ??= { dejaEnPleinEcran: enPleinEcran, maximisee: win.isMaximized() };
  return enPleinEcran;
}

/**
 * Ferme la session et rend la fenêtre au mode qui était le sien. Windows seul.
 *
 * # Ce que ça règle
 *
 * Le plein écran de Windows est ici une PARADE : la fenêtre reste à l'état
 * normal, on lui retire son cadre et on la pose sur tout l'écran (voir l'en-tête
 * du module). Il survivait à la vidéo, si bien qu'on parcourait ensuite tout le
 * catalogue dans une fenêtre sans barre de titre, sans bouton de fermeture, et
 * par-dessus la barre des tâches.
 *
 * La fenêtre retrouve donc EXACTEMENT le mode d'avant le film : fenêtrée si elle
 * l'était, agrandie si elle l'était, et en plein écran si elle y était déjà —
 * auquel cas on ne touche à rien, ce plein écran-là est celui de l'utilisateur et
 * pas celui du film.
 *
 * # macOS suit la même règle, et il a fallu la lui donner
 *
 * Là-bas le plein écran est celui du système, avec son espace dédié, et l'on a
 * longtemps pensé qu'il n'y avait rien à corriger. C'est faux dans un cas : le
 * plein écran POSÉ PAR LE FILM. Quand la fenêtre était fenêtrée et qu'on a
 * appuyé sur « plein écran » dans le lecteur, quitter le film laissait ensuite
 * tout le catalogue dans un espace dédié que personne n'avait demandé.
 *
 * La règle est donc la même que sur Windows, et elle a trois branches et non
 * deux : fenêtrée si elle l'était, ZOOMÉE si elle l'était — le plein écran
 * fenêtré du bouton vert, qui n'est ni l'un ni l'autre —, et en plein écran si
 * elle y était déjà, auquel cas on ne touche à rien.
 */
export function fermerSessionLecteur(win: BrowserWindow): void {
  const session = sessionLecteur;
  sessionLecteur = null;
  if (session === null) return;
  // Le plein écran était le sien avant le film : il lui appartient.
  if (session.dejaEnPleinEcran) return;
  if (!estEnPleinEcran()) return;
  if (PARADE_WINDOWS) {
    sortir(win);
    return;
  }
  rendreModeMacos(win, session.maximisee);
}

/**
 * Sortir du plein écran de macOS, puis rendre l'état zoomé — dans cet ordre, et
 * pas dans le même tour de boucle.
 *
 * `toggleFullScreen:` est ASYNCHRONE : l'animation d'espace dure de l'ordre de
 * la seconde, et tao met son état à jour AVANT de l'appeler. Zoomer tout de
 * suite reviendrait donc à zoomer une fenêtre encore en plein écran, et le
 * serveur de fenêtres tranche cette course comme il veut. On attend l'évènement
 * d'AppKit, qui est la seule annonce fiable que la transition est finie.
 *
 * `once` : la fenêtre vit plus longtemps que la session, et un écouteur laissé
 * en place rezoomerait à la prochaine sortie de plein écran, celle-là voulue.
 */
function rendreModeMacos(win: BrowserWindow, maximisee: boolean): void {
  hote = win;
  const rendreLeZoom = (): void => {
    if (win.isDestroyed()) return;
    if (maximisee && !win.isMaximized()) win.maximize();
    else if (!maximisee && win.isMaximized()) win.unmaximize();
  };

  if (win.isSimpleFullScreen()) {
    // Le plein écran SIMPLE ne change pas d'espace : il n'a pas d'animation à
    // attendre. Une session ouverte avant la bascule vers le natif peut encore
    // s'y trouver.
    win.setSimpleFullScreen(false);
    rendreLeZoom();
    return;
  }
  if (!win.isFullScreen()) {
    rendreLeZoom();
    return;
  }
  win.once("leave-full-screen", rendreLeZoom);
  win.setFullScreen(false);
}

/** Bascule, et renvoie le nouvel état. */
export function basculer(win: BrowserWindow): boolean {
  // macOS : c'est la fenêtre qui sait où elle en est, `avant` restant toujours
  // `null`. S'en remettre à lui ferait entrer en plein écran une fenêtre qui y
  // est déjà, donc ne jamais en sortir.
  if (!PARADE_WINDOWS) {
    hote = win;
    if (estEnPleinEcran()) {
      sortir(win);
      return false;
    }
    entrer(win);
    return true;
  }

  if (avant === null) {
    entrer(win);
    return true;
  }
  sortir(win);
  return false;
}

/** Sort du plein écran, quoi qu'il arrive. */
export function quitter(win: BrowserWindow): void {
  sortir(win);
}
