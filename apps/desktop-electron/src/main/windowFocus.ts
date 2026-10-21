/**
 * Le focus de la fenêtre, donné à la page (`window.tentacle.windowFocus`,
 * `windowFocusBridge.ts`) : macOS seulement, où la page ternit la fenêtre
 * inactive à la façon du système. Ailleurs, rien n'est branché.
 */

import { BrowserWindow, ipcMain, type IpcMainEvent } from "electron";
import { isAppOrigin } from "./appProtocol";
import { WINDOW_FOCUS_CHANNEL, WINDOW_FOCUS_GET_CHANNEL } from "./windowFocusBridge";

let answering = false;

/** Lecture synchrone du preload : le focus de la fenêtre qui porte la page. */
function answer(event: IpcMainEvent): void {
  const window = BrowserWindow.fromWebContents(event.sender);
  // Même règle que le reste du pont : seule NOTRE page reçoit une réponse vraie.
  const trusted = isAppOrigin(event.senderFrame?.url ?? "");
  event.returnValue = trusted && window !== null && !window.isDestroyed() && window.isFocused();
}

export function installWindowFocus(win: BrowserWindow): void {
  if (process.platform !== "darwin") return;
  if (!answering) {
    answering = true;
    ipcMain.on(WINDOW_FOCUS_GET_CHANNEL, answer);
  }
  const send = (focused: boolean): void => {
    if (!win.isDestroyed()) win.webContents.send(WINDOW_FOCUS_CHANNEL, focused);
  };
  win.on("focus", () => send(true));
  win.on("blur", () => send(false));
}
