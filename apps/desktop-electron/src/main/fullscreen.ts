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
 * macOS a le sien, pour une raison différente — voir `PLEIN_ECRAN_SIMPLE`.
 */
const PARADE_WINDOWS = process.platform === "win32";

/**
 * Sur macOS : plein écran SIMPLE, jamais l'espace dédié.
 *
 * ⚠️ Ce n'est PAS le plein écran que macOS a appris à ses utilisateurs, et on
 * le sait : la fenêtre reste sur le bureau courant, posée par-dessus les autres
 * applications, au lieu de partir dans son propre espace. Le natif a été
 * ré-essayé, et il ne tient pas — pour une raison qui n'est pas de notre côté.
 *
 * # Ce que le natif coûte ici, remesuré
 *
 * `setFullScreen(true)` emmène la fenêtre dans un espace dédié. La fenêtre vidéo
 * de mpv l'y suit — elle est sa fille — mais le SERVEUR DE FENÊTRES l'y place
 * DEVANT, et tout l'overlay disparaît : plus de titre, plus de contrôles, plus
 * de bouton pour en sortir. Capture d'écran à l'appui, et relevé de l'extérieur
 * par CoreGraphics, lecture en cours :
 *
 *   rang 6  fenetre 84169 (mpv)     0,33 1512x949
 *   rang 7  fenetre 83892 (la page) 0,33 1512x949
 *
 * ⚠️ Et le pire : **AppKit ne le sait pas**. Interrogé au même instant,
 * `[NSApp orderedWindows]` place la vidéo DERRIÈRE la page. Les deux modèles
 * divergent — on ne peut donc ni constater l'inversion depuis le processus, ni
 * la corriger : `removeChildWindow` suivi de `addChildWindow:ordered:NSWindowBelow`
 * n'y change rien, `NSWindowCollectionBehaviorFullScreenAuxiliary` non plus.
 *
 * Essayés et sans effet, tous vérifiés à l'écran : mettre mpv en plein écran lui
 * aussi (`video/macosFullscreen.ts`), réaffirmer l'empilement de part et d'autre
 * de la transition, et une veille qui le réaffirme dix fois par seconde.
 *
 * # Ce qu'on fait à la place
 *
 * `setSimpleFullScreen` est le plein écran d'avant Lion : la fenêtre couvre
 * l'écran, la barre de menus et le Dock s'effacent, et il n'y a PAS de nouvel
 * espace. Le montage reste donc exactement celui qui fonctionne en fenêtré.
 *
 * L'espace dédié ne reviendra pas par un réglage : il demande que la vidéo cesse
 * d'être une fenêtre à part, donc que la couche Metal de mpv soit hébergée DANS
 * la fenêtre d'Electron. C'est un autre chantier.
 */
const PLEIN_ECRAN_SIMPLE = process.platform === "darwin";

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
    if (PLEIN_ECRAN_SIMPLE) win.setSimpleFullScreen(true);
    // ⚠️ NON VÉRIFIÉ, et assumé comme tel. `setSimpleFullScreen` change le masque
    // de style de la fenêtre, ce qui peut lui faire perdre le statut de fenêtre
    // CLÉ — et AppKit ne livre pas `mouseMoved:` à une fenêtre qui ne l'est pas.
    // C'est la cause la plus probable du symptôme signalé : en plein écran, il
    // faut CLIQUER pour réveiller les contrôles au lieu de bouger la souris.
    // Reproduire le défaut demanderait de poster de vrais évènements de souris,
    // donc l'accès d'assistance : la correction est posée sur un raisonnement,
    // pas sur une mesure. Elle ne coûte rien et ne change rien d'autre.
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
