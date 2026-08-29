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
 * macOS a le sien, pour une raison différente — voir `NATIVE_FULLSCREEN`.
 */
export const WINDOWS_WORKAROUND = process.platform === "win32";

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
 *
 * # Linux : natif aussi — la parade Windows n'a pas de raison d'être ici
 *
 * `transparent: true` y est posé à la CONSTRUCTION de la fenêtre
 * (`linux/window.ts`), pas à l'exécution comme sur Windows : l'alpha survit au
 * plein écran (mesuré sur Wayland, vidéo visible au travers en plein écran —
 * 19,2 % de rouge au banc). Avant cette ligne, `enter()` traversait la branche
 * « ni parade ni natif » et SORTAIT SANS RIEN FAIRE : le bouton plein écran du
 * lecteur était inopérant sur Linux — masqué sur Wayland par `SurfaceWayland`,
 * qui force le sien, et nu sous X11 où mpv reste fenêtré.
 */
const NATIVE_FULLSCREEN = process.platform === "darwin" || process.platform === "linux";

/** Les appels Win32 de la parade, réclamés seulement là où ils existent. */
function win32(): typeof import("./video/win32") {
  return require("./video/win32") as typeof import("./video/win32");
}

/**
 * État d'avant le plein écran, à rendre tel quel. `null` = fenêtré.
 *
 * `maximized` est mémorisé à part : une fenêtre agrandie doit être rendue à son
 * ÉTAT, pas à sa géométrie. Reposer ses seuls bounds donnerait une fenêtre qui
 * a l'air agrandie sans l'être — bouton « restaurer » inversé, double-clic sur
 * la barre de titre incohérent.
 *
 * `normalBounds` est la géométrie que Windows rendra le jour où l'utilisateur
 * restaurera la fenêtre. Le plein écran l'ÉCRASE — `unmaximize` puis un
 * redimensionnement à la taille de l'écran la remplacent par cette taille-là —
 * et sans elle, sortir du plein écran d'une fenêtre agrandie puis la restaurer
 * donnait une fenêtre grande comme l'écran. Mesuré : `460x241` devenait
 * `1920x1106`.
 */
let before: { normalBounds: Rectangle; style: bigint; maximized: boolean } | null = null;

/**
 * La fenêtre servie en dernier, pour interroger macOS à la source.
 *
 * Sur macOS l'état n'est pas à nous : l'utilisateur peut entrer et sortir du
 * plein écran par le bouton vert ou par Ctrl+Cmd+F, sans passer par nous. Une
 * mémoire locale mentirait dès le premier de ces gestes ; on lit donc la
 * fenêtre à chaque question.
 */
let host: BrowserWindow | null = null;

/**
 * Retient la fenêtre à interroger. Sans effet sous Windows, qui tient son état
 * dans `before`.
 *
 * Le geste reste écrit en ligne dans les bascules de ce module ; il n'est nommé
 * que pour la session du lecteur, sortie dans son propre fichier
 * (`playerFullscreenSession.ts`) et qui doit le faire elle aussi.
 */
export function noteWindow(win: BrowserWindow): void {
  if (!WINDOWS_WORKAROUND) host = win;
}

export function isFullscreen(): boolean {
  if (WINDOWS_WORKAROUND) return before !== null;
  if (host === null || host.isDestroyed()) return false;
  // Le SIMPLE est encore interrogé : il n'est plus posé par nous, mais une
  // session ouverte avant une mise à jour peut encore s'y trouver, et une
  // fenêtre dont on ne sait pas qu'elle est en plein écran est une souricière.
  return host.isFullScreen() || host.isSimpleFullScreen();
}

/**
 * L'ordre compte : le cadre part d'abord, la géométrie ensuite. L'inverse
 * poserait la fenêtre à la taille de l'écran AVEC son cadre, et la zone client
 * serait alors trop petite — un liseré de bureau le temps d'une image.
 */
/**
 * Deux mesures existent, et une seule compte.
 *
 * `GetClientRect` (Win32) est ce que `alignBelow` donne à mpv, donc ce qui
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
function enter(win: BrowserWindow): void {
  if (before !== null) return;

  // macOS : le plein écran du système, avec son espace dédié — voir
  // `NATIVE_FULLSCREEN`. `before` reste `null` : c'est la fenêtre elle-même qui
  // porte l'état, et `isFullscreen` le lui demande.
  if (!WINDOWS_WORKAROUND) {
    host = win;
    if (NATIVE_FULLSCREEN) win.setFullScreen(true);
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

  const maximized = win.isMaximized();
  // Capturés AVANT `unmaximize`, et pour deux usages distincts : `bounds` dit
  // où la fenêtre se trouve pour l'utilisateur, donc sur quel écran ouvrir ;
  // `normalBounds` est la géométrie de restauration, que la suite va écraser.
  const bounds = win.getBounds();
  const normalBounds = win.getNormalBounds();

  // 1. Lever l'état agrandi D'ABORD. Windows contraint la géométrie tant qu'il
  //    dure, et Chromium recalcule sa zone non-cliente avec les marges
  //    d'agrandissement — d'où les 12 DIP de largeur perdus quand on le laisse.
  //    L'état est rendu en sortant, c'est `maximized` qui le porte.
  if (maximized) win.unmaximize();

  // 2. Retirer le cadre ensuite : posé avant, `unmaximize` le défait.
  const style = win32().stripFrame(nativeHandle(win));
  before = { normalBounds, style, maximized };

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

function exit(win: BrowserWindow): void {
  if (!WINDOWS_WORKAROUND) {
    host = win;
    // Les deux, dans cet ordre : une session ouverte avant la bascule vers le
    // natif peut encore être en plein écran simple, et la touche Échap doit
    // rendre la main dans les deux cas.
    if (win.isSimpleFullScreen()) win.setSimpleFullScreen(false);
    if (win.isFullScreen()) win.setFullScreen(false);
    return;
  }

  const memory = before;
  if (memory === null) return;
  before = null;
  win32().restoreFrame(nativeHandle(win), memory.style);
  // La géométrie normale D'ABORD, agrandissement ensuite. C'est elle que
  // Windows retiendra comme taille de restauration ; la reposer seulement
  // quand la fenêtre était fenêtrée laisserait une fenêtre agrandie rendre la
  // taille de l'écran au premier clic sur « restaurer ».
  win.setBounds(memory.normalBounds);
  if (memory.maximized) win.maximize();
}

/** Bascule, et renvoie le nouvel état. */
export function toggle(win: BrowserWindow): boolean {
  // macOS : c'est la fenêtre qui sait où elle en est, `before` restant toujours
  // `null`. S'en remettre à lui ferait entrer en plein écran une fenêtre qui y
  // est déjà, donc ne jamais en sortir.
  if (!WINDOWS_WORKAROUND) {
    host = win;
    if (isFullscreen()) {
      exit(win);
      return false;
    }
    enter(win);
    return true;
  }

  if (before === null) {
    enter(win);
    return true;
  }
  exit(win);
  return false;
}

/** Sort du plein écran, quoi qu'il arrive. */
export function leave(win: BrowserWindow): void {
  exit(win);
}
