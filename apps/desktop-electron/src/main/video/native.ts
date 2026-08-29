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
export function neverThrow(what: string, action: () => void): void {
  try {
    action();
  } catch (e) {
    console.warn(`[video] ${what} en echec, lecture poursuivie : ${String(e)}`);
  }
}

/**
 * Descripteur natif d'une fenêtre Electron, en valeur.
 *
 * Le tampon rendu par Electron porte un `HWND` sous Windows et un pointeur de
 * `NSView` sous macOS — deux mots de 64 bits, lus de la même façon. C'est
 * précisément ce qui permet de passer `--wid` à mpv sur les deux systèmes.
 *
 * ⚠️ **Sous Linux il n'en fait que QUATRE**, et l'ignorer coûtait toute la
 * vidéo. `readBigUInt64LE` y levait `ERR_BUFFER_OUT_OF_BOUNDS`, dans
 * `ipc/video.ts` qui calcule le `wid` AVANT de savoir s'il en aura l'usage :
 * `mpv_init` échouait donc net, sans qu'aucune image ne soit jamais demandée.
 * Le panneau de diagnostic annonçait « SDR » — et il avait raison, il n'y avait
 * simplement aucune sortie à décrire.
 *
 * On lit donc ce que le tampon contient. Sous X11 c'est le numéro de fenêtre
 * réel ; sous Wayland, Electron rend `1`, une valeur sans signification — ce
 * qui n'est pas gênant, mpv n'y reçoit jamais de `wid`.
 */
export function nativeHandle(win: BrowserWindow): bigint {
  const buffer = win.getNativeWindowHandle();
  if (buffer.length >= 8) return buffer.readBigUInt64LE(0);
  if (buffer.length >= 4) return BigInt(buffer.readUInt32LE(0));
  return 0n;
}
