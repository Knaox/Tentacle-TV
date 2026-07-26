/**
 * Point d'entrée du processus principal.
 *
 * Ordre volontaire : identité et chemins d'abord, schéma privilégié ensuite
 * (Electron exige qu'il soit déclaré AVANT `whenReady`), puis le durcissement,
 * puis seulement la fenêtre.
 */

import { app, BrowserWindow } from "electron";
import path from "node:path";
import { APP_ORIGIN, APP_SCHEME, registerAppScheme, serveApp, webRoot } from "./appProtocol";
import { buildCsp, buildPluginCsp, hashesFromFile } from "./csp";
import { COMMANDS } from "./channels";
import { PLUGIN_HOST } from "./pluginDocuments";
import { CommandRegistry } from "./ipc/registry";
import { registerPluginCommands } from "./ipc/plugins";
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
    const pluginOrigin = `${APP_SCHEME}://${PLUGIN_HOST}`;
    const appCsp = buildCsp(APP_ORIGIN, pluginOrigin, hashes);
    const pluginCsp = buildPluginCsp(APP_ORIGIN);

    // Une politique par origine. Le serveur Jellyfin de l'utilisateur n'est pas
    // à nous : on ne réécrit pas ses en-têtes.
    installContentSecurityPolicy((url) => {
      if (!url.startsWith(`${APP_SCHEME}://`)) return null;
      return url.startsWith(`${pluginOrigin}/`) ? pluginCsp : appCsp;
    });
    serveApp();

    const registry = new CommandRegistry();
    registerShellCommands(registry);
    registerPluginCommands(registry);
    registry.install();
    registerShellCapabilities();

    // Trace de migration : les commandes encore absentes seront livrées par
    // les phases suivantes (lecteur, telechargements, mises a jour).
    const missing = registry.missing(COMMANDS);
    if (missing.length > 0) {
      console.info(`[tentacle] ${missing.length} commandes restent a implementer`);
    }

    // La page reçoit la liste de ce qui EST branché, pas de ce qui manque :
    // elle n'a ainsi rien à savoir de la migration, seulement à demander
    // « sais-tu télécharger ? » avant d'afficher le bouton.
    const capabilities = registry.implemented();

    const win = createMainWindow(capabilities);
    void win.loadURL(`${APP_ORIGIN}/index.html`);

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        const next = createMainWindow(capabilities);
        void next.loadURL(`${APP_ORIGIN}/index.html`);
      }
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}

main();
