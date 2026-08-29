/**
 * Fenêtre principale et plein écran.
 *
 * Les dimensions reprennent EXACTEMENT celles de l'app Tauri
 * (`tauri.windows.conf.json`) : 1280x800, minimum 900x600, décorée, fond noir.
 * La parité visuelle se joue aussi là.
 */

import { app, BrowserWindow } from "electron";
import path from "node:path";
import { windowIconPath } from "./appIcon";
import { broadcastFullscreen, installFullscreenSync } from "./fullscreenSync";
import { BANNER_HEIGHT, macosFrameOptions } from "./macosTitleBar";
import { linuxFrameOptions } from "./linux/window";
import { linuxWindowing, linuxMontage } from "./linux/session";
import { sessionShown } from "./linux/sessionRescue";
import { lockNavigation } from "./security";
import { toggle as toggleWindowFullscreen, isFullscreen } from "./fullscreen";
import { closePlayerSession, openPlayerSession } from "./playerFullscreenSession";

const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 800;
const MIN_WIDTH = 900;
const MIN_HEIGHT = 600;

let mainWindow: BrowserWindow | null = null;

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

/**
 * Rend la surface de Chromium transparente, ou opaque.
 *
 * C'est ICI que se joue la visibilité de la vidéo, et nulle part ailleurs : la
 * fenêtre reste une fenêtre Windows ordinaire, seule la surface de Chromium
 * passe à alpha nul, le temps d'une lecture. Voir `createMainWindow` pour
 * pourquoi le drapeau `transparent` de fabrication est banni.
 */
export function setPlayerSurfaceTransparent(on: boolean): void {
  const win = mainWindow;
  if (!win) return;
  win.setBackgroundColor(on ? "#00000000" : "#000000");

  // ⚠️ ET L'OMBRE DE LA FENÊTRE PART AVEC. C'est elle qui dessinait le halo
  // autour du texte et de la seek bar, en FENÊTRÉ seulement.
  //
  // macOS calcule l'ombre d'une NSWindow transparente depuis son MASQUE ALPHA.
  // Notre fenêtre est fabriquée `transparent: true` (voir `createMainWindow`) :
  // chaque pixel opaque de la page — chaque glyphe du minutage, la barre de
  // progression, les boutons — projette donc sa propre ombre sur ce qui est
  // derrière, c'est-à-dire SUR LA FENÊTRE DE MPV. Une fenêtre en plein écran
  // natif n'a pas d'ombre : d'où des contrôles nets en plein écran et haloés en
  // fenêtré, à CSS strictement identique. Capture d'écran des deux à l'appui.
  //
  // Trois traces de ce mécanisme existaient déjà, sans qu'il soit nommé :
  //  - `macosChildWindow.ts` a mesuré que retirer cette ombre AGGRAVE le liseré
  //    de la fenêtre mpv (14,6 → 50). Elle tombe donc bien dessus, et elle
  //    l'assombrissait — c'est la contrepartie assumée ici, couverte depuis la
  //    page (voir `bordureVideo` côté web) ;
  //  - le retrait du voile (« le ghosting en fenetre ») concluait qu'il restait
  //    « plus que la zone des contrôles eux-mêmes ». C'était ce résidu ;
  //  - `setHasShadow:NO` était déjà posé sur la fenêtre DE MPV, jamais la nôtre.
  //
  // Elle revient à la sortie de lecture : hors du lecteur la page est opaque,
  // l'ombre est celle d'une fenêtre ordinaire et rien ne la reçoit.
  if (process.platform === "darwin") win.setHasShadow(!on);

  // ⚠️ Sur macOS, ON NE TOUCHE PLUS à l'opacité de la NSWindow, et surtout pas
  // avec `setOpaque:`.
  //
  // La fenêtre y naît `transparent: true` (voir `createMainWindow`) : Chromium
  // possède alors sa propre notion de l'opacité de cette NSWindow et la pilote
  // au fil de la composition. La lui changer sous les pieds en pleine lecture
  // faisait TOMBER le processus de rendu — la fenêtre se figeait, le processus
  // principal restant parfaitement vivant. Diagnostic : pile du thread principal
  // dans sa boucle d'évènements normale, et plus un seul processus de rendu.
  //
  // `setBackgroundColor` seul suffit, et c'est la même ligne que sous Windows.
}



/**
 * @param commands Commandes réellement branchées, annoncées à la page.
 *   L'interface s'en sert pour masquer ce que ce shell ne sait pas encore
 *   faire, au lieu d'afficher un bouton qui rejette. Passées par argument de
 *   fabrication plutôt que par un canal : c'est disponible dès le preload,
 *   sans IPC synchrone et sans course au démarrage.
 */
export function createMainWindow(commands: readonly string[]): BrowserWindow {
  // Étalé plutôt que posé à `undefined` : sous `exactOptionalPropertyTypes`,
  // une propriété facultative absente et une propriété valant `undefined` ne
  // sont pas la même chose.
  const icon = windowIconPath();

  const win = new BrowserWindow({
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    title: "Tentacle",
    ...(icon === null ? {} : { icon }),
    // Fenêtre ORDINAIRE : cadre natif, redimensionnable, plein écran.
    //
    // ⚠️ SOUS WINDOWS, NE PAS y remettre `transparent: true`. Ce drapeau y
    // retire le cadre, empêche le redimensionnement ET casse `setFullScreen` —
    // on s'y retrouve enfermé en plein écran, constaté. Il n'y est de toute
    // façon PAS nécessaire : `setBackgroundColor` avec un alpha nul, appliqué à
    // l'EXÉCUTION, rend la surface de Chromium transparente et laisse voir la
    // fenêtre vidéo de mpv placée dessous. Mesuré sur maquette : cadre présent,
    // redimensionnement et agrandissement disponibles, vidéo visible. Même
    // partage que l'app Tauri (`mpv_window.rs:78`), où une fenêtre transparente
    // en permanence sort Windows du chemin de présentation opaque et fait
    // scintiller chaque transition.
    //
    // ⚠️ SUR macOS, C'EST L'INVERSE : ce drapeau est INDISPENSABLE, et rien ne
    // le remplace. Chromium n'alloue une surface avec canal alpha que si la
    // fenêtre est fabriquée transparente ; sans lui, la vue Chromium reste
    // opaque et peint du noir PAR-DESSUS la fenêtre de mpv, quoi qu'on demande
    // ensuite à `setBackgroundColor` ou à `setOpaque:`. Le symptôme est celui
    // que décrit `macosSurface.ts` — le son sort, l'image reste noire.
    //
    // Mesuré au proto, toutes choses égales par ailleurs, en comptant les
    // PIXELS de la fenêtre capturée pendant une lecture :
    //
    //   sans le drapeau : 13 % de pixels non noirs, 80 teintes   → rien à voir
    //   avec le drapeau : 92 % de pixels non noirs, 1588 teintes → la vidéo
    //
    // Et il ne coûte ici aucun des trois défauts qu'il cause sous Windows :
    // cadre, redimensionnement et plein écran restent tous fonctionnels.
    //
    // ⚠️ `titleBarStyle: "hidden"` L'ACCOMPAGNE, et ce n'est pas cosmétique.
    // `transparent: true` retire déjà toute décoration visible, mais AppKit
    // continue de RÉSERVER la barre de titre : mesuré, la fenêtre fait 800
    // points de haut et la page n'en couvre que 768. Les 32 points du haut ne
    // sont alors peints par personne — ni par la page, ni par la vidéo calée
    // sur le rectangle de contenu — et comme la surface est transparente, on y
    // voit le BUREAU à travers. C'est le liseré parasite constaté au bord de
    // l'overlay. Avec ce style, page et cadre coïncident : 1280x800 des deux
    // côtés, et `MacosSurface` cale la vidéo sur le cadre entier.
    //
    // Ce que ce style ne fait PAS, c'est retirer les feux de circulation : ils
    // se retrouvent sur le contenu, et c'est la page qui doit leur rendre une
    // bande. Voir `macosTitleBar.ts`, qui porte aussi leur position.
    ...macosFrameOptions(),
    // Linux se range du côté de macOS : le drapeau à la construction, sans rien
    // perdre du cadre ni du redimensionnement. Mesuré — voir `linux/window.ts`.
    ...linuxFrameOptions(),
    backgroundColor: "#000000",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      // Le lecteur doit continuer à rendre quand la fenêtre passe derrière :
      // sans ça, la barre de progression se fige pendant une lecture.
      backgroundThrottling: false,
      additionalArguments: [
        `--tentacle-version=${app.getVersion()}`,
        `--tentacle-platform=${process.platform}`,
        `--tentacle-commands=${commands.join(",")}`,
        // Zéro hors macOS : la page ne dessine alors aucun bandeau, la fenêtre
        // ayant son vrai cadre. Une constante en double côté web finirait par
        // diverger de celle qui place les feux et retranche à la vidéo.
        `--tentacle-titlebar=${process.platform === "darwin" ? BANNER_HEIGHT : 0}`,
        // Le montage vidéo de Linux — `wayland` ou `x11`, vide ailleurs. Il
        // décide du HDR et de la lecture plein écran ; la page doit pouvoir le
        // DIRE, et le panneau de diagnostic est le premier endroit où on le
        // cherche. Par argument comme le reste : disponible dès le preload.
        `--tentacle-montage=${linuxMontage() ?? ""}`,
        // Le fenêtré Wayland — `libre` (colle KWin) ou `plein-ecran` (forcé).
        // La page en a besoin pour SE TAIRE : l'avis pédagogique du plein
        // écran n'a de sens que là où il est réellement imposé.
        `--tentacle-fenetrage=${linuxWindowing() ?? ""}`,
      ],
    },
  });

  lockNavigation(win.webContents);

  // En DÉVELOPPEMENT seulement, on relaie la console du rendu et les échecs de
  // chargement dans le terminal. Sans ça, une violation de CSP ou un module
  // introuvable ne laisse qu'un écran noir, sans le moindre indice.
  //
  // Rien de tout ceci n'existe dans un paquet livré, et aucun drapeau ne peut
  // l'y rallumer : les outils de développement ouverts chez un utilisateur
  // seraient une surface d'attaque, pas un service.
  //
  // Ce relais ne suffit PAS à lui seul : le build de production de `apps/web`
  // supprime `console.log`, `console.debug` et `console.info` (`pure` dans
  // `vite.config.ts`), et un échec au niveau du réseau n'écrit rien dans la
  // console du rendu. D'où les outils de développement, ouverts d'office.
  if (!app.isPackaged) {
    win.webContents.on("console-message", (event) => {
      console.log(`[rendu:${event.level}] ${event.message} (${event.lineNumber})`);
    });
    win.webContents.on("did-fail-load", (_e, code, description, url) => {
      console.error(`[rendu] chargement echoue ${code} ${description} — ${url}`);
    });
    win.webContents.on("did-finish-load", () => {
      console.log("[rendu] chargement termine");
    });
    win.webContents.on("render-process-gone", (_e, details) => {
      console.error(`[rendu] processus perdu: ${JSON.stringify(details)}`);
    });
    // `TENTACLE_SANS_DEVTOOLS=1` : une session de mesure à l'écran (captures,
    // pixels comptés) n'a que faire d'une fenêtre DevTools posée par-dessus le
    // panneau de diagnostic — elle faussait chaque cliché du banc.
    if (process.env["TENTACLE_SANS_DEVTOOLS"] !== "1") {
      win.webContents.openDevTools({ mode: "detach" });
    }
  }

  // Plein écran : AppKit, F11, et la sortie de session du lecteur. Tout est dans
  // `fullscreenSync.ts` — trois sources à réconcilier, ce n'est plus un détail
  // de fabrication.
  installFullscreenSync(win);

  // Fenêtre révélée seulement quand la page est prête : sinon on montre un
  // rectangle vide le temps du premier rendu.
  win.once("ready-to-show", () => {
    win.show();
    // La fenêtre a prouvé qu'elle s'affiche : l'essai d'un choix de session
    // explicite est concluant (sans effet sinon — voir `linux/sessionRescue.ts`).
    sessionShown();
  });

  win.on("closed", () => {
    mainWindow = null;
  });

  mainWindow = win;
  return win;
}

/** Bascule le plein écran et renvoie le nouvel état. */
export function toggleFullscreen(): boolean {
  const win = mainWindow;
  if (!win) return false;
  return toggleWindowFullscreen(win);
}

/**
 * Ouvre la session plein écran du lecteur et renvoie l'état COURANT — c'est lui
 * qui amorce l'état React du lecteur, remonté à chaque épisode.
 */
export function enterPlayerFullscreenScope(): boolean {
  const win = mainWindow;
  if (!win || win.isDestroyed()) return false;
  return openPlayerSession(win);
}

/**
 * Ferme la session plein écran du lecteur.
 *
 * Sur macOS la fenêtre ne bouge PAS : fenêtrée, zoomée ou en plein écran, elle
 * reste comme l'utilisateur l'a laissée. Sous Windows elle retrouve le mode
 * d'avant le film, parce que le plein écran y est une parade qui la laisserait
 * sans cadre. Tout est dans `fermerSessionLecteur`.
 */
export function leavePlayerFullscreenScope(): void {
  const win = mainWindow;
  if (!win || win.isDestroyed()) return;
  closePlayerSession(win);
  // L'état doit redescendre à la page : sans cela l'icône du bouton plein écran
  // et la touche Échap restaient en désaccord avec la fenêtre réelle. Conservé
  // pour Windows, où la parade ne fait naître aucun évènement d'AppKit.
  broadcastFullscreen(win, isFullscreen());
}
