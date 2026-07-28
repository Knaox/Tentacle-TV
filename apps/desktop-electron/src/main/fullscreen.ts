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
import { nativeHandle, rendreLeCadre, retirerLeCadre } from "./video/win32";

/**
 * État d'avant le plein écran, à rendre tel quel. `null` = fenêtré.
 *
 * `maximisee` est mémorisé à part : une fenêtre maximisée doit être rendue à
 * son ÉTAT, pas à sa géométrie. Reposer ses seuls `bounds` donnerait une
 * fenêtre qui a l'air maximisée sans l'être — bouton « restaurer » inversé,
 * double-clic sur la barre de titre incohérent.
 */
let avant: { bounds: Rectangle; style: bigint; maximisee: boolean } | null = null;

export function estEnPleinEcran(): boolean {
  return avant !== null;
}

/**
 * L'ordre compte : le cadre part d'abord, la géométrie ensuite. L'inverse
 * poserait la fenêtre à la taille de l'écran AVEC son cadre, et la zone client
 * serait alors trop petite — un liseré de bureau le temps d'une image.
 */
function entrer(win: BrowserWindow): void {
  if (avant !== null) return;
  const maximisee = win.isMaximized();
  const bounds = win.getBounds();
  const style = retirerLeCadre(nativeHandle(win));
  avant = { bounds, style, maximisee };

  // Une fenêtre MAXIMISÉE refuse d'être déplacée : Windows contraint
  // `setBounds` à la zone de travail tant qu'elle est dans cet état, et la
  // barre des tâches restait donc visible en plein écran. Mesuré : maximisée
  // puis `setBounds(1920x1080)` rend `1920x1032` ; après `unmaximize`, `1080`.
  //
  // L'état est rendu en sortant — c'est `maximisee` qui le porte.
  if (maximisee) win.unmaximize();

  // `getDisplayMatching` et NON `getDisplayNearestPoint` : le second attend un
  // POINT et ne lit donc que le coin supérieur gauche — or Windows fait
  // déborder une fenêtre maximisée de quelques pixels, et ce coin tombe alors
  // dans l'écran VOISIN. Mesuré sur un poste à trois écrans : fenêtre maximisée
  // sur l'écran principal (0,0), `getBounds()` rend `x=-7 y=-7`, et l'écran
  // placé à gauche commence à `x=-1152`. Le plein écran partait chez lui.
  //
  // `getDisplayMatching` prend le RECTANGLE et rend l'écran qui en couvre le
  // plus — juste pour une fenêtre débordante comme pour une fenêtre à cheval.
  //
  // Calculé sur les bounds d'AVANT `unmaximize` : ce sont eux qui disent où la
  // fenêtre se trouvait pour l'utilisateur.
  //
  // `bounds` et non `workArea` : la barre des tâches doit être recouverte.
  win.setBounds(screen.getDisplayMatching(bounds).bounds);
}

function sortir(win: BrowserWindow): void {
  const memoire = avant;
  if (memoire === null) return;
  avant = null;
  rendreLeCadre(nativeHandle(win), memoire.style);
  // Re-maximiser plutôt que reposer la géométrie : Windows connaît lui-même
  // les bounds fenêtrés à rendre le jour où l'utilisateur restaurera.
  if (memoire.maximisee) win.maximize();
  else win.setBounds(memoire.bounds);
}

/** Bascule, et renvoie le nouvel état. */
export function basculer(win: BrowserWindow): boolean {
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
