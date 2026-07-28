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
 * Sur macOS il n'a pas lieu d'être, et l'appliquer serait même nuisible. La
 * vidéo n'y est pas posée sous la surface de Chromium mais portée par une
 * NSWindow ENFANT (voir `macosSurface.ts`) : le plein écran natif n'a donc
 * aucune transparence à préserver, et macOS déplace l'enfant avec son parent.
 * On retrouve ainsi ce qu'un utilisateur Mac attend — espace dédié, animation
 * système, Mission Control — que la parade Windows lui retirerait.
 */
const PARADE_WINDOWS = process.platform === "win32";

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
  if (!PARADE_WINDOWS) return hote !== null && !hote.isDestroyed() && hote.isFullScreen();
  return avant !== null;
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

  // macOS : le plein écran natif, sans détour. `avant` reste `null` — c'est la
  // fenêtre elle-même qui porte l'état, et `estEnPleinEcran` le lui demande.
  if (!PARADE_WINDOWS) {
    hote = win;
    win.setFullScreen(true);
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

/** Bascule, et renvoie le nouvel état. */
export function basculer(win: BrowserWindow): boolean {
  // macOS : c'est la fenêtre qui sait où elle en est, `avant` restant toujours
  // `null`. S'en remettre à lui ferait entrer en plein écran une fenêtre qui y
  // est déjà, donc ne jamais en sortir.
  if (!PARADE_WINDOWS) {
    hote = win;
    if (win.isFullScreen()) {
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
