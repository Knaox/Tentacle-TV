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

/** État d'avant le plein écran, à rendre tel quel. `null` = fenêtré. */
let avant: { bounds: Rectangle; style: bigint } | null = null;

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
  const bounds = win.getBounds();
  const style = retirerLeCadre(nativeHandle(win));
  avant = { bounds, style };
  // `bounds` et non `workArea` : la barre des tâches doit être recouverte.
  win.setBounds(screen.getDisplayNearestPoint(bounds).bounds);
}

function sortir(win: BrowserWindow): void {
  const memoire = avant;
  if (memoire === null) return;
  avant = null;
  rendreLeCadre(nativeHandle(win), memoire.style);
  win.setBounds(memoire.bounds);
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
