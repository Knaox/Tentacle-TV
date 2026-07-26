/**
 * Commandes de coquille : plein écran, liens externes, sélecteur de dossier,
 * redémarrage.
 *
 * Les trois dernières ne passent pas par la table des commandes : ce sont des
 * capacités du shell, pas des commandes métier, et le preload les expose
 * nommément.
 */

import { app, dialog, ipcMain, type IpcMainInvokeEvent } from "electron";
import { z } from "zod";
import { openExternalSafely } from "../security";
import {
  enterPlayerFullscreenScope,
  getMainWindow,
  leavePlayerFullscreenScope,
  toggleFullscreen,
} from "../window";
import { CommandRegistry, isTrustedSender } from "./registry";

const NO_ARGS = z.object({}).passthrough();

export function registerShellCommands(registry: CommandRegistry): void {
  registry
    .add("toggle_fullscreen", { schema: NO_ARGS, run: () => toggleFullscreen() })
    .add("player_fullscreen_enter", { schema: NO_ARGS, run: () => enterPlayerFullscreenScope() })
    .add("player_fullscreen_leave", {
      schema: NO_ARGS,
      run: () => {
        leavePlayerFullscreenScope();
      },
    });
}

/** Capacités exposées nommément par le preload, hors table des commandes. */
export function registerShellCapabilities(): void {
  ipcMain.handle("tentacle:open-external", async (event: IpcMainInvokeEvent, raw: unknown) => {
    if (!isTrustedSender(event)) return;
    const url = z.string().url().safeParse(raw);
    if (!url.success) return;
    await openExternalSafely(url.data);
  });

  ipcMain.handle("tentacle:pick-folder", async (event: IpcMainInvokeEvent) => {
    if (!isTrustedSender(event)) return null;
    const win = getMainWindow();
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      properties: ["openDirectory", "createDirectory"],
    });
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });

  ipcMain.handle("tentacle:relaunch", (event: IpcMainInvokeEvent) => {
    if (!isTrustedSender(event)) return;
    app.relaunch();
    app.exit(0);
  });
}
