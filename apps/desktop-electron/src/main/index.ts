/**
 * Point d'entrée du processus principal.
 *
 * Ordre volontaire : identité et chemins d'abord, schéma privilégié ensuite
 * (Electron exige qu'il soit déclaré AVANT `whenReady`), puis le durcissement,
 * puis seulement la fenêtre.
 */

import { app, BrowserWindow } from "electron";
import path from "node:path";
import {
  APP_ORIGIN,
  APP_SCHEME,
  LOCAL_ORIGIN,
  registerAppScheme,
  serveApp,
  webRoot,
} from "./appProtocol";
import { demarrerBattement } from "./battement";
import { dossierDonnees } from "./cheminsDonnees";
import { appliquerSessionGraphique, montageLinux } from "./linux/session";
import { buildCsp, buildPluginCsp, hashesFromFile } from "./csp";
import { COMMANDS } from "./channels";
import { PLUGIN_HOST } from "./pluginDocuments";
import { CommandRegistry } from "./ipc/registry";
import { registerDownloadsEngineCommands } from "./ipc/downloadsEngine";
import { registerDownloadsPlaybackCommands } from "./ipc/downloadsPlayback";
import { registerDownloadsStorageCommands } from "./ipc/downloadsStorage";
import { registerJellyfinCommands } from "./ipc/jellyfin";
import { stopDownloadsRuntime, transfertsEnCours } from "./downloadsRuntime";
import { closeLocalDb } from "./localDb";
import { demanderNatif, installerGardeSortie } from "./quitGuard";
import { registerMediaKeyCommands, releaseMediaKeys } from "./ipc/mediaKeys";
import { registerMigrationBridge } from "./ipc/migration";
import { registerPluginCommands } from "./ipc/plugins";
import { registerSessionCommands } from "./ipc/session";
import { registerShellCapabilities, registerShellCommands, rendreVeilleEcran } from "./ipc/shell";
import { registerUpdateCommands } from "./ipc/updates";
import { registerLinuxSessionCommands } from "./ipc/linuxSession";
import { registerVideoCommands, restaurerEcran } from "./ipc/video";
import { claimSingleInstance, denyAllPermissions, installContentSecurityPolicy } from "./security";
import { installerMenu } from "./menu";
import { appliquerIdentiteSysteme } from "./appIdentity";
import { createMainWindow, getMainWindow } from "./window";

/**
 * Ce qu'on ajoute à l'adresse de départ. Vide, sauf en mise au point.
 *
 * `TENTACLE_AUTOWATCH=<itemId>` fait démarrer l'application directement sur la
 * lecture de ce média. C'est l'outil qui rend une session de debug du lecteur
 * reproductible : juger le HDR ou le calage de la fenêtre demande de relancer
 * l'application des dizaines de fois, et refaire le parcours à la souris à
 * chaque essai finissait par décider de ce qu'on testait.
 *
 * ⚠️ `autowatch` jamais dans un paquet livré : la reprise vit dans
 * `dev/autoWatch.tsx`, que le build de production n'embarque pas — le paramètre
 * n'y serait qu'une curiosité dans la barre d'adresse. `debugpanel`, lui, passe
 * même en paquet : voir plus bas.
 */
function routeDeDepart(): string {
  const parametres: string[] = [];
  if (!app.isPackaged) {
    const cible = process.env["TENTACLE_AUTOWATCH"];
    if (cible !== undefined && cible !== "") {
      parametres.push(`autowatch=${encodeURIComponent(cible)}`);
    }
  }
  // `TENTACLE_DEBUG_PANEL=1` ouvre le panneau de diagnostic d'office : juger le
  // rendu demande de relancer sans cesse, et le rouvrir à la main à chaque fois
  // finit par décider de ce qu'on observe.
  //
  // ⚠️ Y COMPRIS EN PAQUET. Le paquet qu'on instrumente (`package:macos:debug`)
  // est un miroir de prod : `app.isPackaged` y est vrai, et la garde d'ensemble
  // rendait donc la variable inopérante précisément là où elle sert — seul le
  // bouton DEBUG restait, à ouvrir à la main. Aucun risque pour un paquet
  // livré : le panneau n'existe dans le bundle que si `__PLAYER_DEBUG__` est
  // vrai (figé au build par `TENTACLE_DEBUG=1`), sinon le paramètre est inerte.
  if (process.env["TENTACLE_DEBUG_PANEL"] === "1") parametres.push("debugpanel=1");
  return parametres.length === 0 ? "" : `?${parametres.join("&")}`;
}

function useExistingUserData(): void {
  // Sous MSIX, %APPDATA% est redirigé de façon transparente vers le conteneur
  // du paquet — le même dossier que celui de l'app Tauri. Rien à migrer.
  // Sur Linux, c'est `cheminsDonnees.ts` qui redresse la divergence XDG.
  app.setPath("userData", dossierDonnees({
    plateforme: process.platform,
    appData: app.getPath("appData"),
    home: app.getPath("home"),
    env: process.env,
  }));
}

/**
 * Dit à mpv qu'il tourne DANS un paquet — sinon il vole l'icône du Dock.
 *
 * ⚠️ mpv remplace l'icône de l'application ENTIÈRE, pas la sienne. Dans
 * `video/out/mac/common.swift` :
 *
 *     func initApp() { NSApp.setActivationPolicy(policy); setAppIcon() }
 *     func setAppIcon() {
 *       if !AppHub.shared.isBundle { NSApp.applicationIconImage = AppHub.shared.getIcon() }
 *     }
 *
 * et `isBundle` n'est rien d'autre que
 * `ProcessInfo.processInfo.environment["MPVBUNDLE"] == "true"`
 * (`osdep/mac/app_hub.swift`). Le garde-fou existe pour que la mpv de Homebrew,
 * lancée au terminal, se donne quand même une icône ; nous, nous en avons une.
 *
 * `initApp()` tourne à la création de la SORTIE VIDÉO, donc au premier
 * `loadfile` puisqu'on pose `force-window=no` : l'icône tenait jusqu'au premier
 * film, et changeait ensuite. Elle rechange à chaque nouvelle sortie vidéo.
 *
 * ⚠️ AVANT tout chargement de libmpv, et c'est la seule contrainte — tenue de
 * loin, `mpvFfi.ts` charge la bibliothèque à la première lecture. Vérifié au
 * préalable : `ProcessInfo.processInfo.environment` relit `environ`, un
 * `setenv()` postérieur au démarrage du processus est donc bien vu.
 *
 * Les autres effets d'`isBundle` ne nous concernent pas : le préfixe de `PATH`
 * n'a lieu qu'avec `--macos-bundle-path`, qu'on ne pose pas ; la résolution
 * « osxbundle » des chemins de configuration ne trouve rien dans nos
 * `Resources` ; et la barre de menus de mpv n'en dépend pas.
 */
function declarerMpvEnPaquet(): void {
  if (process.platform !== "darwin") return;
  process.env["MPVBUNDLE"] = "true";
}

function main(): void {
  declarerMpvEnPaquet();

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
  // ⚠️ APRÈS le dossier de données — le choix s'y lit — et AVANT `whenReady` :
  // Electron fixe sa plateforme d'affichage à ce moment-là, et un drapeau posé
  // ensuite n'a plus d'effet. C'est ce choix qui décide du HDR et du montage
  // de la fenêtre vidéo ; voir `linux/sessionGraphique.ts`.
  appliquerSessionGraphique();
  registerAppScheme();

  // ⚠️ Le `.catch` n'est pas une précaution de style.
  //
  // Sans lui, une exception levée dans ce bloc part en rejet non traité que
  // rien n'affiche : l'application reste vivante, sa boucle d'évènements tourne
  // normalement — et elle n'a AUCUNE fenêtre. Pas de message, pas de plantage,
  // rien à quoi se raccrocher. Constaté sur macOS : trois processus debout, zéro
  // processus de rendu, un journal vide. Le diagnostic a demandé un
  // échantillonnage de pile pour établir ce qu'une ligne aurait dit.
  void app
    .whenReady()
    .then(() => {
      // AVANT le menu : celui-ci porte `app.getName()` comme libellé de son
      // entrée d'application, et le panneau « À propos » qu'il ouvre lit les
      // options posées ici.
      appliquerIdentiteSysteme();
      // Retiré sous Windows, fourni sur macOS — où l'absence de menu prive les
      // champs de saisie de Cmd+C, Cmd+V et Cmd+A. Voir `menu.ts`.
      installerMenu();

      // Le pouls du thread principal : il ne dit rien tant que tout va bien, et
      // date le gel à la milliseconde le jour où il y en a un.
      demarrerBattement();

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
      registerLinuxSessionCommands(registry);
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
        // Les NOMMER, et pas seulement les compter : sous Linux, une commande
        // absente fait disparaître en silence une section entière de l'interface
        // (`capabilities.ts`), et le compte seul ne dit pas laquelle.
        console.info(`[tentacle] ${missing.length} commandes restent a implementer : ${missing.join(", ")}`);
      }

      // La page reçoit la liste de ce qui EST branché, pas de ce qui manque :
      // elle n'a ainsi rien à savoir de la migration, seulement à demander
      // « sais-tu télécharger ? » avant d'afficher le bouton.
      const capabilities = registry.implemented();

      // La garde de sortie est posée à la fabrication, jamais après : entre les
      // deux, un Alt+F4 emporterait un téléchargement sans un mot.
      const ouvrir = (): void => {
        const fenetre = createMainWindow(capabilities);
        installerGardeSortie(fenetre, transfertsEnCours, demanderNatif(fenetre));
        void fenetre.loadURL(`${APP_ORIGIN}/${routeDeDepart()}`);
      };

      ouvrir();

      app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) ouvrir();
      });
    })
    .catch((erreur: unknown) => {
      console.error(`[tentacle] demarrage impossible : ${String(erreur)}`);
      if (erreur instanceof Error && erreur.stack !== undefined) console.error(erreur.stack);
      app.quit();
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
    // Même devoir pour l'anti-veille : un blocage laissé actif empêcherait
    // l'écran de s'éteindre longtemps après la fermeture de l'application.
    rendreVeilleEcran();
    stopDownloadsRuntime();
    closeLocalDb();
    // La connexion X reste ouverte tant que la surface vidéo peut caler une
    // fenêtre. Chargement paresseux : hors X11, le module n'est jamais importé,
    // et `libX11.so.6` n'est jamais ouverte.
    if (montageLinux() === "x11") {
      (require("./linux/x11") as typeof import("./linux/x11")).fermerAffichageX11();
    }
  });

  /**
   * Fermer la fenêtre ferme l'application — sur macOS AUSSI, contre la coutume.
   *
   * La coutume veut qu'une application macOS survive à ses fenêtres. Elle a du
   * sens pour un traitement de texte, qui en ouvre plusieurs ; elle n'en a aucun
   * ici, où il n'y a qu'une fenêtre et où il n'y a rien à faire sans elle. Ce que
   * l'utilisateur y gagnait, mesuré : une application qu'il croit fermée mais qui
   * tient toujours la barre de menus, et dont la réouverture — par `activate`,
   * qui refabrique une fenêtre dans le MÊME processus — hérite de tout l'état
   * vidéo de la session d'avant. mpv est encore initialisé, sa surface pointe une
   * fenêtre détruite : la lecture suivante donne un écran noir en plein écran, et
   * une fenêtre transparente sinon. C'est le défaut du « second lancement ».
   *
   * Quitter pour de bon rend l'état neuf à chaque ouverture. La sortie emprunte
   * le chemin de Cmd+Q, celui que la garde de sortie surveille : un
   * téléchargement en cours fait toujours poser la question avant de partir.
   */
  app.on("window-all-closed", () => {
    app.quit();
  });
}

main();
