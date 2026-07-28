/**
 * L'opacité de la fenêtre sur macOS — ce qui décide qu'on VOIT la vidéo.
 *
 * # Pourquoi `setBackgroundColor` ne suffit pas ici
 *
 * Sous Windows, poser un alpha nul sur la surface de Chromium suffit : la
 * fenêtre enfant de mpv, placée dessous, apparaît. C'est ce que fait
 * `setPlayerSurfaceTransparent`, et c'est mesuré.
 *
 * ⚠️ Sur macOS, une `NSWindow` reste **opaque** tant que `setOpaque:` n'a pas
 * été posé à `NO`, quoi qu'on demande à Chromium. Notre fenêtre vidéo étant une
 * fenêtre SŒUR attachée en dessous (`NSWindowBelow`, voir `macosSurface.ts`),
 * une fenêtre hôte opaque la masque intégralement. Le symptôme est connu et
 * trompeur : **le son sort, l'image reste noire** — on croit à un défaut de
 * décodage alors que mpv joue parfaitement, derrière un mur.
 *
 * # Pourquoi pas le drapeau `transparent` de fabrication
 *
 * Parce qu'il fait deux choses et qu'une seule sert : il retire le cadre,
 * empêche le redimensionnement et casse le plein écran. `createMainWindow`
 * l'explique déjà pour Windows, et l'app Tauri l'a abandonné pour la même
 * raison. On bascule donc l'opacité à l'EXÉCUTION, le temps d'une lecture,
 * exactement comme `apps/desktop/src-tauri/src/macos/window_opacity.rs`.
 *
 * # Pourquoi le noir, et pas la couleur système, hors lecture
 *
 * Rendre l'opacité ne rend pas le fond : la fenêtre retrouverait la couleur
 * système. On force `blackColor`, qui est `--surface-0` côté web — ce qu'on
 * aperçoit avant le premier rendu et pendant un redimensionnement à la souris,
 * là où l'on verrait sinon le bureau. Même choix que Tauri.
 *
 * ⚠️ **macOS uniquement** : ce module remonte à `objc.ts`, qui charge le
 * runtime Objective-C à l'import.
 */

import type { BrowserWindow } from "electron";
import { cls, depuisHandle, msg } from "./objc";

/** La `NSWindow` d'une fenêtre Electron, via sa `NSView` racine. */
function fenetreNative(win: BrowserWindow): unknown {
  return msg.get(depuisHandle(win.getNativeWindowHandle()), "window");
}

/** Une couleur de la classe `NSColor`, par son sélecteur de fabrique. */
function couleur(nom: string): unknown {
  const nsColor = cls("NSColor");
  if (!nsColor) return null;
  return msg.get(nsColor, nom);
}

/**
 * Laisse voir la fenêtre vidéo placée dessous, ou la masque à nouveau.
 *
 * Idempotent, et sans effet si la fenêtre native n'est pas joignable — auquel
 * cas on perd la vidéo, pas l'application.
 */
export function rendreTransparent(win: BrowserWindow, transparent: boolean): void {
  const fenetre = fenetreNative(win);
  if (!fenetre) return;

  // L'ORDRE compte à l'entrée : poser une couleur claire sur une fenêtre encore
  // opaque la ferait apparaître noire le temps d'une image.
  if (transparent) {
    msg.setFlag(fenetre, "setOpaque:", false);
    msg.setObjet(fenetre, "setBackgroundColor:", couleur("clearColor"));
    return;
  }

  // À la sortie, l'ordre s'inverse pour la même raison : le fond d'abord, pour
  // qu'aucune image ne montre le bureau à travers une fenêtre encore claire.
  msg.setObjet(fenetre, "setBackgroundColor:", couleur("blackColor"));
  msg.setFlag(fenetre, "setOpaque:", true);
}
