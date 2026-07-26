/**
 * Point d'entrée du processus principal.
 *
 * Ordre volontaire : identité et chemins d'abord, schéma privilégié ensuite
 * (Electron exige qu'il soit déclaré AVANT `whenReady`), puis le durcissement,
 * puis seulement la fenêtre.
 */

import { app, BrowserWindow } from "electron";
import path from "node:path";
import { APP_ORIGIN, registerAppScheme, serveApp, webRoot } from "./appProtocol";
import { buildCsp, hashesFromFile } from "./csp";
import { COMMANDS } from "./channels";
import { CommandRegistry } from "./ipc/registry";
import { registerShellCapabilities, registerShellCommands } from "./ipc/shell";
import { claimSingleInstance, denyAllPermissions, installContentSecurityPolicy } from "./security";
import { createMainWindow, getMainWindow } from "./window";

/**
 * Identifiant hérité de l'app Tauri.
 *
 * Il fixe le dossier de données, donc l'accès à `tentacle-local.db` et aux
 * téléchargements DÉJÀ présents chez l'utilisateur. En changer rendrait
 * invisibles les films qu'il a téléchargés.
 */
const TAURI_IDENTIFIER = "com.tentacle.media";

function useExistingUserData(): void {
  // Sous MSIX, %APPDATA% est redirigé de façon transparente vers le conteneur
  // du paquet — le même dossier que celui de l'app Tauri. Rien à migrer.
  app.setPath("userData", path.join(app.getPath("appData"), TAURI_IDENTIFIER));
}

function main(): void {
  const solo = claimSingleInstance(() => {
    const win = getMainWindow();
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });
  if (!solo) {
    app.quit();
    return;
  }

  useExistingUserData();
  registerAppScheme();

  void app.whenReady().then(() => {
    denyAllPermissions();
    // Empreintes calculées sur le HTML réellement servi : le script inline
    // qui pose le thème avant le premier paint reste autorisé, sans ouvrir
    // `unsafe-inline` à tout le reste.
    const hashes = hashesFromFile(path.join(webRoot(), "index.html"));
    installContentSecurityPolicy(buildCsp(APP_ORIGIN, hashes));
    serveApp();

    const registry = new CommandRegistry();
    registerShellCommands(registry);
    registry.install();
    registerShellCapabilities();

    // Trace de migration : les commandes encore absentes seront livrées par
    // les phases suivantes (lecteur, telechargements, mises a jour).
    const missing = registry.missing(COMMANDS);
    if (missing.length > 0) {
      console.info(`[tentacle] ${missing.length} commandes restent a implementer`);
    }

    const win = createMainWindow();
    void win.loadURL(`${APP_ORIGIN}/index.html`);

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        const next = createMainWindow();
        void next.loadURL(`${APP_ORIGIN}/index.html`);
      }
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}

main();
