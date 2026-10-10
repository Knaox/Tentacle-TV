/**
 * La fenêtre est-elle sur le bureau (Space) affiché ? — macOS seulement.
 *
 * ⚠️ Remonte à `objc.ts`, qui charge le runtime Objective-C à l'import : ne
 * s'importe que sous macOS (`require` paresseux chez l'appelant).
 */

import type { BrowserWindow } from "electron";
import { fromHandle, msg } from "./objc";

export function onActiveSpace(win: BrowserWindow): boolean {
  if (win.isDestroyed()) return false;
  return msg.bool(msg.get(fromHandle(win.getNativeWindowHandle()), "window"), "isOnActiveSpace");
}
