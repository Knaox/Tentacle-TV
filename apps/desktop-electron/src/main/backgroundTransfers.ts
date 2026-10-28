/**
 * « Continuer en arrière-plan » (bureau) : le réglage et la fin des transferts fenêtre fermée
 * (`backgroundDrain.ts`), reliés à Electron.
 *
 * Le réglage est de CET appareil, allumé par défaut, dans la base locale (clé `background_transfers`, la même
 * que le mobile) : le processus principal le lit au moment de la fermeture, sans aller-retour avec la page.
 * La page le règle par `downloads_background_get` / `downloads_background_set` (Réglages › Téléchargements,
 * et les Réglages d'Octave).
 */

import { app, Notification } from "electron";
import { settingGet, settingSet } from "./downloads/core/db";
import { transfersBusy, transfersInFlight } from "./downloadsRuntime";
import { stopAudio } from "./ipc/audio";
import { localDb } from "./localDb";
import { createBackgroundDrain } from "./backgroundDrain";
import type { ExitRequest } from "./quitGuard";

const BACKGROUND_KEY = "background_transfers";
const QUIT_MARK_MS = 1_500;

export function backgroundTransfersOn(): boolean {
  try {
    return settingGet(localDb(), BACKGROUND_KEY) !== "0";
  } catch {
    // Base illisible : le défaut.
    return true;
  }
}

export function setBackgroundTransfers(on: boolean): boolean {
  settingSet(localDb(), BACKGROUND_KEY, on ? "1" : "0");
  return on;
}

/** Une notification du système, une fois : l'application n'a plus de fenêtre, mais elle n'est pas partie. */
function announce(pending: number): void {
  if (!Notification.isSupported()) return;
  const fr = app.getLocale().toLowerCase().startsWith("fr");
  const body = fr
    ? pending === 1
      ? "Tentacle finit un téléchargement, puis se fermera."
      : `Tentacle finit ${String(pending)} téléchargements, puis se fermera.`
    : pending === 1
      ? "Tentacle is finishing a download, then it will close."
      : `Tentacle is finishing ${String(pending)} downloads, then it will close.`;
  new Notification({ title: fr ? "Téléchargements en arrière-plan" : "Downloads in the background", body, silent: true }).show();
}

export const backgroundDrain = createBackgroundDrain({
  pending: transfersInFlight,
  busy: transfersBusy,
  quit: () => app.quit(),
  // `quit` et non `exit` : la sortie garde son nettoyage (`will-quit` : base refermée, touches média rendues).
  relaunch: () => {
    app.relaunch();
    app.quit();
  },
  stopPlayback: stopAudio,
  announce,
  now: () => Date.now(),
  every: (ms, tick) => {
    const timer = setInterval(tick, ms);
    return { stop: () => clearInterval(timer) };
  },
});

let quitRequested = false;
/** « Quitter quand même » a été répondu : la fenêtre qui se ferme ensuite quitte pour de bon. */
let quitConfirmed = false;

/** La question de la garde de sortie, qui retient la réponse « quitter » (`finishTransfersWithoutWindow`). */
export function rememberQuitAnswer(ask: ExitRequest): ExitRequest {
  return async (inProgress) => {
    const quit = await ask(inProgress);
    if (quit) quitConfirmed = true;
    return quit;
  };
}

/**
 * Quitter (Cmd+Q, menu, mise à jour) n'est pas fermer la fenêtre : `before-quit` arrive AVANT la fermeture des
 * fenêtres, et la garde de sortie pose alors sa question comme avant. À poser une fois, au démarrage.
 */
export function watchQuitRequests(): void {
  app.on("before-quit", () => {
    quitRequested = true;
    // Une sortie refusée (« Annuler ») ne doit pas changer la croix pour la suite de la session : la
    // fermeture des fenêtres suit `before-quit` de près, la marque retombe ensuite.
    setTimeout(() => {
      quitRequested = false;
    }, QUIT_MARK_MS).unref?.();
  });
}

/** Ce que la garde de sortie consulte : fermer la fenêtre laisse-t-il les transferts finir ? */
export const closeKeepsTransfers = (): boolean => !quitRequested && backgroundTransfersOn();

/**
 * La dernière fenêtre est fermée (`window-all-closed`) : des transferts restent et le réglage le veut → le
 * processus les finit sans elle (vrai) ; sinon (faux) l'appelant quitte, comme avant.
 */
export function finishTransfersWithoutWindow(): boolean {
  if (backgroundDrain.active()) return true;
  if (quitConfirmed || transfersInFlight() <= 0 || !closeKeepsTransfers()) return false;
  backgroundDrain.begin();
  return true;
}
