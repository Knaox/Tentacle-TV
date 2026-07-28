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
import { lockNavigation } from "./security";
import {
  basculer as basculerPleinEcran,
  estEnPleinEcran,
  quitter as quitterPleinEcran,
} from "./fullscreen";

const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 800;
const MIN_WIDTH = 900;
const MIN_HEIGHT = 600;

let mainWindow: BrowserWindow | null = null;

/**
 * Mémoire du plein écran À L'ENTRÉE du lecteur.
 *
 * Le lecteur ne rend la fenêtre à l'état fenêtré que s'il l'a lui-même mise en
 * plein écran. Si l'utilisateur y était DÉJÀ avant de lancer la vidéo, quitter
 * le lecteur ne doit rien défaire : ce plein écran est le sien.
 *
 * L'état vit ici et non dans un ref React : le lecteur est démonté puis
 * remonté à chaque épisode (`key={itemId}`), et un ref repartirait à zéro
 * alors que la fenêtre, elle, est toujours en plein écran.
 */
let fullscreenOnEntry: boolean | null = null;

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
    ...(process.platform === "darwin" ? { transparent: true, titleBarStyle: "hidden" } : {}),
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
    win.webContents.openDevTools({ mode: "detach" });
  }

  // Diffuse tout changement de plein écran, QUELLE QUE SOIT SA SOURCE — notre
  // bascule, F11, ou la sortie automatique du lecteur. Sans cette diffusion,
  // l'icône du bouton et la touche Échap partaient en désaccord avec la
  // fenêtre réelle.
  const broadcast = (value: boolean): void => {
    if (!win.isDestroyed()) win.webContents.send("tentacle:window://fullscreen", value);
  };

  // F11 sort du plein écran, quoi qu'il arrive.
  //
  // C'est le raccourci que tout le monde connaît sous Windows, et le menu
  // applicatif — retiré parce qu'il se voyait pendant la lecture — était le
  // seul à le fournir. Sans lui, un plein écran dont les contrôles ne se
  // révèlent pas devient une souricière. Traité AVANT la page, pour rester
  // valable même si l'interface est occupée.
  win.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown" || input.key !== "F11") return;
    event.preventDefault();

    // DEUX plein-écrans coexistent et ne se recouvrent pas toujours : celui de
    // la FENÊTRE (le nôtre, cf. `fullscreen.ts`) et celui du DOCUMENT
    // (`requestFullscreen`, posé par la page). N'en quitter qu'un donne
    // exactement le symptôme observé : une fenêtre dont on ne sort plus. F11
    // sort donc des DEUX, et n'entre que si aucun des deux n'est actif — sans
    // quoi la touche cesserait de basculer.
    const fenetre = estEnPleinEcran();
    void win.webContents
      .executeJavaScript(
        "(() => { const e = !!document.fullscreenElement; if (e) document.exitFullscreen(); return e; })()",
        true,
      )
      .catch(() => false)
      .then((document: unknown) => {
        const etait = fenetre || document === true;
        if (etait) quitterPleinEcran(win);
        else basculerPleinEcran(win);
        broadcast(estEnPleinEcran());
        if (app.isPackaged) return;
        console.log(
          `[fenetre] F11 — avant : fenetre=${fenetre} document=${String(document)}` +
            ` → fenetre=${estEnPleinEcran()}`,
        );
      });
  });

  // Fenêtre révélée seulement quand la page est prête : sinon on montre un
  // rectangle vide le temps du premier rendu.
  win.once("ready-to-show", () => win.show());

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
  return basculerPleinEcran(win);
}

/**
 * Ouvre la session plein écran du lecteur et renvoie l'état COURANT.
 * Idempotente : un changement d'épisode remonte le lecteur sans fermer la
 * session, la mémoire d'entrée n'est donc pas réécrite.
 */
export function enterPlayerFullscreenScope(): boolean {
  if (!mainWindow) return false;
  const now = estEnPleinEcran();
  if (fullscreenOnEntry === null) fullscreenOnEntry = now;
  return now;
}

/**
 * Ferme la session : ne sort du plein écran QUE si c'est le lecteur qui l'a
 * activé. Ne le ré-active jamais — si l'utilisateur en est sorti pendant la
 * lecture, on respecte son geste.
 */
export function leavePlayerFullscreenScope(): void {
  const win = mainWindow;
  const entry = fullscreenOnEntry;
  fullscreenOnEntry = null;
  if (win && entry === false && estEnPleinEcran()) quitterPleinEcran(win);
}
