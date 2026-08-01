/**
 * Ce que la couche vidéo sait faire SANS connaître le système.
 *
 * # Pourquoi ce fichier existe
 *
 * `win32.ts` charge `user32.dll` **à l'import du module**. Trois fonctions y
 * vivaient pourtant qui n'ont rien de Windows — un journal, un garde-fou et la
 * lecture d'un descripteur de fenêtre. Les laisser là revenait à exiger
 * `user32.dll` pour écrire une ligne de journal : sur macOS, le simple fait
 * d'importer `fullscreen.ts` ou `ipc/updates.ts` faisait tomber le processus
 * principal avant même que la fenêtre n'existe.
 *
 * Elles sont donc ici, et `win32.ts` les réexporte : aucun appelant existant
 * n'a changé d'import, et le code Windows reste mot pour mot le même.
 */

import { app } from "electron";
import type { BrowserWindow } from "electron";

/** Journal de la surface vidéo, sur un build de diagnostic. */
export function trace(message: string): void {
  if (!app.isPackaged) console.log(`[video] ${message}`);
}

/**
 * Exécute une opération native sans jamais emporter le processus principal.
 *
 * ⚠️ Ces opérations tournent dans des rappels de minuteur : une exception y est
 * fatale, Electron ferme l'application en pleine lecture. Le désarmement et le
 * calage sont des CONFORTS — leur échec dégrade, il ne doit jamais empêcher de
 * regarder un film. Même contrat que l'app Tauri (`mpv_window.rs:137`).
 */
export function sansFaillir(quoi: string, action: () => void): void {
  try {
    action();
  } catch (e) {
    console.warn(`[video] ${quoi} en echec, lecture poursuivie : ${String(e)}`);
  }
}

/**
 * Descripteur natif d'une fenêtre Electron, en valeur.
 *
 * Le tampon rendu par Electron porte un `HWND` sous Windows et un pointeur de
 * `NSView` sous macOS — deux mots de 64 bits, lus de la même façon. C'est
 * précisément ce qui permet de passer `--wid` à mpv sur les deux systèmes.
 */
export function nativeHandle(win: BrowserWindow): bigint {
  return win.getNativeWindowHandle().readBigUInt64LE(0);
}
