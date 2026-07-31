/**
 * Tenir la PAGE au courant du plein écran de la fenêtre.
 *
 * Extrait de `window.ts`, qui n'a plus à porter que la fabrication : diffuser un
 * état et fabriquer une fenêtre sont deux métiers, et celui-ci a désormais trois
 * sources à réconcilier — AppKit, F11, et la sortie de session du lecteur.
 *
 * # Ce que la page en fait
 *
 * L'icône du bouton plein écran et la touche Échap en dépendaient déjà. Le
 * bandeau d'hôte s'y est ajouté (`HostTitleBar`, via `useHostFullscreen`) : il
 * doit se démonter en plein écran, faute de quoi une bande opaque reste posée en
 * haut d'un film.
 */

import { app, type BrowserWindow } from "electron";
import {
  basculer as basculerPleinEcran,
  estEnPleinEcran,
  quitter as quitterPleinEcran,
} from "./fullscreen";

/** Envoie l'état à la page. Sans effet sur une fenêtre détruite. */
export function diffuserPleinEcran(win: BrowserWindow, valeur: boolean): void {
  if (!win.isDestroyed()) win.webContents.send("tentacle:window://fullscreen", valeur);
}

/**
 * Branche les trois sources. À appeler une fois, à la fabrication.
 *
 * ⚠️ Les évènements d'AppKit couvrent TOUTES les bascules de macOS — bouton
 * vert, commande de menu, Ctrl+Cmd+F, et notre propre `toggle_fullscreen`.
 * Aucune ne diffusait auparavant : seuls F11 et la sortie de session du lecteur
 * le faisaient, si bien que la page ignorait presque toujours qu'elle était en
 * plein écran. Le bandeau d'hôte l'a rendu visible — il restait affiché
 * par-dessus le film, et le plein écran avait l'air de ne pas prendre.
 *
 * Sur Windows ils n'arrivent jamais : le plein écran y est une PARADE et la
 * fenêtre demeure à l'état normal (voir `fullscreen.ts`). Ce sont les deux
 * autres sources qui l'y couvrent.
 */
export function installerSyncPleinEcran(win: BrowserWindow): void {
  const diffuser = (valeur: boolean): void => diffuserPleinEcran(win, valeur);

  win.on("enter-full-screen", () => diffuser(true));
  win.on("leave-full-screen", () => {
    diffuser(false);
    tracerFenetres();
  });

  installerF11(win, diffuser);
}

/**
 * Dit ce que l'application a à l'écran en sortant du plein écran.
 *
 * Une SECONDE barre de fenêtre, feux compris, apparaît à ce moment-là — la
 * nôtre, ou celle de mpv ressuscitée, et rien dans une capture ne les distingue.
 * Voir `macosDiagFenetres.ts`, qui porte les deux hypothèses.
 *
 * ⚠️ `require` et non `import` : le module remonte à `objc.ts`, qui charge le
 * runtime Objective-C dès l'import et ferait tomber le processus principal sous
 * Windows. Même parade que `fullscreen.ts` pour `win32.ts`.
 */
function tracerFenetres(): void {
  if (process.platform !== "darwin") return;
  if (app.isPackaged && process.env["TENTACLE_DEBUG_PANEL"] !== "1") return;
  try {
    const diag = require("./macosDiagFenetres") as typeof import("./macosDiagFenetres");
    console.log(`[fenetre] sortie de plein ecran —\n${diag.decrireFenetres()}`);
  } catch (erreur) {
    console.warn(`[fenetre] diagnostic indisponible : ${String(erreur)}`);
  }
}

/**
 * F11 sort du plein écran, quoi qu'il arrive.
 *
 * C'est le raccourci que tout le monde connaît sous Windows, et le menu
 * applicatif — retiré parce qu'il se voyait pendant la lecture — était le seul à
 * le fournir. Sans lui, un plein écran dont les contrôles ne se révèlent pas
 * devient une souricière. Traité AVANT la page, pour rester valable même si
 * l'interface est occupée.
 */
function installerF11(win: BrowserWindow, diffuser: (valeur: boolean) => void): void {
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
        diffuser(estEnPleinEcran());
        if (app.isPackaged) return;
        console.log(
          `[fenetre] F11 — avant : fenetre=${fenetre} document=${String(document)}` +
            ` → fenetre=${estEnPleinEcran()}`,
        );
      });
  });
}
