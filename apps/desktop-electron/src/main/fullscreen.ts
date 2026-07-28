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
/**
 * L'ordre des trois gestes n'est pas négociable — chacun a été mesuré sur la
 * ZONE CLIENT, la seule qui compte : c'est elle que `calerSous` donne à mpv
 * (`GetClientRect`), donc elle qui décide si la vidéo a des bords noirs.
 *
 * Sur un écran 1920x1080 DIP, en partant d'une fenêtre agrandie :
 *
 *   cadre → unmaximize → setBounds          client 1908x1042  (manque 12x38)
 *   unmaximize → cadre → setBounds          client 1920x1054  (manque  0x26)
 *   unmaximize → cadre → setContentBounds   client 1920x1080  PLEINE
 */
function entrer(win: BrowserWindow): void {
  if (avant !== null) return;
  const maximisee = win.isMaximized();
  // Capturé AVANT `unmaximize` : c'est ce rectangle qui dit où la fenêtre se
  // trouvait pour l'utilisateur, donc sur quel écran ouvrir.
  const bounds = win.getBounds();

  // 1. Lever l'état maximisé D'ABORD. Windows contraint la géométrie tant
  //    qu'il dure, et Chromium recalcule sa zone non-cliente avec les marges
  //    de maximisation — d'où les 12 DIP de largeur perdus quand on le laisse.
  //    L'état est rendu en sortant, c'est `maximisee` qui le porte.
  if (maximisee) win.unmaximize();

  // 2. Retirer le cadre ensuite : posé avant, `unmaximize` le défait.
  const style = retirerLeCadre(nativeHandle(win));
  avant = { bounds, style, maximisee };

  // 3. `setContentBounds` et NON `setBounds` : le second dimensionne la FENÊTRE,
  //    cadre compris, et Chromium garde une zone non-cliente résiduelle même
  //    sans `WS_CAPTION` — 26 DIP de hauteur qui manquaient à la vidéo. Le
  //    premier dimensionne la zone CLIENT, exactement ce que mpv reçoit.
  //
  // `getDisplayMatching` et NON `getDisplayNearestPoint` : le second attend un
  // POINT et ne lit que le coin supérieur gauche — or Windows fait déborder une
  // fenêtre agrandie de quelques pixels, et ce coin tombe alors dans l'écran
  // VOISIN. Mesuré sur un poste à trois écrans : agrandie sur l'écran principal
  // (0,0), `getBounds()` rend `x=-7 y=-7`, et l'écran de gauche commence à
  // `x=-1152`. Le plein écran partait chez lui.
  //
  // `bounds` et non `workArea` : la barre des tâches doit être recouverte.
  win.setContentBounds(screen.getDisplayMatching(bounds).bounds);
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
