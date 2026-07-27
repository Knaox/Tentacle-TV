/**
 * Point d'entrée du processus principal.
 *
 * Ordre volontaire : identité et chemins d'abord, schéma privilégié ensuite
 * (Electron exige qu'il soit déclaré AVANT `whenReady`), puis le durcissement,
 * puis seulement la fenêtre.
 */

import { app, BrowserWindow, Menu } from "electron";
import path from "node:path";
import {
  APP_ORIGIN,
  APP_SCHEME,
  LOCAL_ORIGIN,
  registerAppScheme,
  serveApp,
  webRoot,
} from "./appProtocol";
import { buildCsp, buildPluginCsp, hashesFromFile } from "./csp";
import { COMMANDS } from "./channels";
import { PLUGIN_HOST } from "./pluginDocuments";
import { CommandRegistry } from "./ipc/registry";
import { registerDownloadsEngineCommands } from "./ipc/downloadsEngine";
import { registerDownloadsPlaybackCommands } from "./ipc/downloadsPlayback";
import { registerDownloadsStorageCommands } from "./ipc/downloadsStorage";
import { registerJellyfinCommands } from "./ipc/jellyfin";
import { stopDownloadsRuntime } from "./downloadsRuntime";
import { closeLocalDb } from "./localDb";
import { registerMediaKeyCommands, releaseMediaKeys } from "./ipc/mediaKeys";
import { registerMigrationBridge } from "./ipc/migration";
import { registerPluginCommands } from "./ipc/plugins";
import { registerSessionCommands } from "./ipc/session";
import { registerShellCapabilities, registerShellCommands } from "./ipc/shell";
import { registerUpdateCommands } from "./ipc/updates";
import { registerVideoCommands, restaurerEcran } from "./ipc/video";
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
    // Electron pose un menu applicatif par défaut — Fichier, Édition,
    // Affichage, Fenêtre. L'app Tauri n'en a aucun, et il se voyait en haut de
    // la fenêtre pendant la lecture. L'interface est intégralement en HTML :
    // ce menu n'apporte rien et abîme le plein écran.
    //
    // Sous Windows, les raccourcis d'édition (copier, coller) restent traités
    // nativement par le moteur de rendu dans les champs de saisie ; sur macOS
    // ils dépendent du menu, il faudra donc en fournir un le jour venu.
    if (process.platform !== "darwin") Menu.setApplicationMenu(null);

    denyAllPermissions();
    // Empreintes calculées sur le HTML réellement servi : le script inline
    // qui pose le thème avant le premier paint reste autorisé, sans ouvrir
    // `unsafe-inline` à tout le reste.
    const hashes = hashesFromFile(path.join(webRoot(), "index.html"));
    const pluginOrigin = `${APP_SCHEME}://${PLUGIN_HOST}`;
    const appCsp = buildCsp(APP_ORIGIN, pluginOrigin, LOCAL_ORIGIN, hashes);
    const pluginCsp = buildPluginCsp(APP_ORIGIN);

    // Une politique par origine. Le serveur Jellyfin de l'utilisateur n'est pas
    // à nous : on ne réécrit pas ses en-têtes.
    installContentSecurityPolicy((url) => {
      if (!url.startsWith(`${APP_SCHEME}://`)) return null;
      return url.startsWith(`${pluginOrigin}/`) ? pluginCsp : appCsp;
    });
    serveApp();

    // Branché AVANT la fenêtre : le preload de la première page réclame le
    // dump de migration dès sa création, en synchrone. Un canal absent à cet
    // instant, et l'utilisateur démarre déconnecté.
    registerMigrationBridge();

    const registry = new CommandRegistry();
    registerShellCommands(registry);
    registerJellyfinCommands(registry);
    registerMediaKeyCommands(registry);
    registerPluginCommands(registry);
    registerSessionCommands(registry);
    registerUpdateCommands(registry);
    registerVideoCommands(registry);
    // Stockage et lecture AVANT le moteur : c'est `downloads_list`, enregistrée
    // en dernier par lui, qui fait basculer `supportsDownloads()` côté page. Dès
    // qu'elle répond, toute la section réapparaît et appelle les autres.
    registerDownloadsStorageCommands(registry);
    registerDownloadsPlaybackCommands(registry);
    registerDownloadsEngineCommands(registry);
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
    void win.loadURL(`${APP_ORIGIN}/`);

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        const next = createMainWindow(capabilities);
        void next.loadURL(`${APP_ORIGIN}/`);
      }
    });
  });

  // Filet de sécurité : l'écran est rendu à son état d'origine même si la
  // fermeture court-circuite `mpv_destroy`. La base est refermée dans la
  // foulée — WAL laisse sinon un journal à rejouer au prochain lecteur du
  // fichier, qui peut être l'app Tauri sur une machine de développement.
  app.on("will-quit", () => {
    restaurerEcran();
    // Les touches média sont captées pour TOUT le système : les rendre est un
    // devoir, pas un nettoyage. Une fermeture qui court-circuite `smtc_clear`
    // les laisserait prises jusqu'au redémarrage de la session.
    releaseMediaKeys();
    stopDownloadsRuntime();
    closeLocalDb();
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}

main();
