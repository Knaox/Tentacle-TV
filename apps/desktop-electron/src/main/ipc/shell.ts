/**
 * Commandes de coquille : plein écran, veille de l'écran, liens externes,
 * sélecteur de dossier, redémarrage.
 *
 * Les trois dernières ne passent pas par la table des commandes : ce sont des
 * capacités du shell, pas des commandes métier, et le preload les expose
 * nommément.
 */

import { app, dialog, ipcMain, powerSaveBlocker, type IpcMainInvokeEvent } from "electron";
import { z } from "zod";
import { creerVeilleEcran } from "../powerSave";
import { openExternalSafely } from "../security";
import {
  enterPlayerFullscreenScope,
  getMainWindow,
  leavePlayerFullscreenScope,
  toggleFullscreen,
} from "../window";
import { CommandRegistry, isTrustedSender } from "./registry";

const NO_ARGS = z.object({}).passthrough();

/** Instance unique : c'est elle qui garde l'identifiant du blocage en cours. */
const veilleEcran = creerVeilleEcran(powerSaveBlocker);

/**
 * Rend l'écran à sa veille normale, quoi qu'il arrive.
 *
 * Exporté pour la fermeture (`will-quit`), comme `releaseMediaKeys` : une sortie
 * qui court-circuite `prevent_display_sleep_stop` laisserait l'écran de
 * l'utilisateur allumé jusqu'à la fin de sa session.
 */
export function rendreVeilleEcran(): void {
  veilleEcran.rendre();
}

export function registerShellCommands(registry: CommandRegistry): void {
  registry
    .add("toggle_fullscreen", { schema: NO_ARGS, run: () => toggleFullscreen() })
    .add("player_fullscreen_enter", { schema: NO_ARGS, run: () => enterPlayerFullscreenScope() })
    .add("player_fullscreen_leave", {
      schema: NO_ARGS,
      run: () => {
        leavePlayerFullscreenScope();
      },
    })
    .add("prevent_display_sleep_start", {
      schema: NO_ARGS,
      run: () => {
        veilleEcran.empecher();
      },
    })
    .add("prevent_display_sleep_stop", {
      schema: NO_ARGS,
      run: () => {
        veilleEcran.rendre();
      },
    });
}

/** Capacités exposées nommément par le preload, hors table des commandes. */
export function registerShellCapabilities(): void {
  /**
   * ⚠️ `z.string().url()` ne filtre PAS les schémas : il accepte tout ce que
   * `new URL()` sait analyser, `javascript:`, `file:` et `smb:` compris. Ce n'est
   * donc pas un contrôle de sécurité, seulement un contrôle de forme.
   *
   * Le seul portier est `openExternalSafely` et sa liste blanche de schémas.
   * Corollaire : ne jamais appeler `shell.openExternal` directement ailleurs, et
   * n'ajouter un schéma à cette liste qu'avec une raison forte — les trois
   * schémas de store (`macappstore:`, `itms-apps:`, `ms-windows-store:`) y sont
   * déjà, ouvrir une fiche d'App Store ne demande rien de plus.
   */
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
