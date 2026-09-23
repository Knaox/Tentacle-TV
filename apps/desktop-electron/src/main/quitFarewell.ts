/**
 * La sortie retenue le temps de dire à Jellyfin que la lecture s'arrête.
 *
 * Branché dans l'unique écouteur `will-quit` de `index.ts`, en tête : c'est le
 * seul point commun à la croix (`window-all-closed` → `app.quit()`), à Cmd+Q
 * et au menu. `before-quit` ne convient pas — sur Cmd+Q il précède la
 * fermeture des fenêtres, et la garde des téléchargements peut encore annuler
 * la sortie : on aurait annoncé l'arrêt d'une lecture qui continue.
 *
 * Premier passage : s'il reste quelque chose à dire, on retient la sortie, on
 * poste, puis `app.quit()` relance la séquence. Le second passage laisse faire
 * le nettoyage synchrone, une seule fois. `app.exit()` (relance après mise à
 * jour) court-circuite tout, comme pour la garde de sortie.
 */

import { app } from "electron";
import { postFarewellStop } from "./ipc/jellyfin";
import { FAREWELL_DEADLINE_MS, playbackFarewell } from "./playbackFarewell";
import { isRunning, setProperty } from "./video/mpv";

let farewellDone = false;

/** Vrai si la sortie est retenue : l'appelant rend la main sans nettoyer. */
export function holdQuitForFarewell(event: { preventDefault: () => void }): boolean {
  if (farewellDone || !playbackFarewell.pending()) return false;
  farewellDone = true;
  event.preventDefault();
  // Le son se tait pendant qu'on poste : sous Windows et macOS, mpv n'est pas
  // arrêté à la fermeture (il meurt avec le processus) et sa fenêtre a déjà
  // disparu avec la nôtre. Sous Linux, la séquence de fermeture l'a arrêté.
  // Écriture ASYNCHRONE : jamais de propriété mpv en synchrone hors Windows.
  if (isRunning()) void setProperty("pause", "yes").catch(() => undefined);
  void playbackFarewell.farewell(postFarewellStop, FAREWELL_DEADLINE_MS).finally(() => {
    app.quit();
  });
  return true;
}
