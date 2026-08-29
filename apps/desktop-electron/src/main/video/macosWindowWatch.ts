/**
 * Guetter l'apparition de la fenêtre que mpv vient de créer.
 *
 * Sorti de `macosSurface.ts`, qui orchestre le montage : attendre qu'un tiers
 * fasse naître une fenêtre et tenir cette fenêtre calée sous la nôtre sont deux
 * métiers, et le premier n'a besoin que d'une classe et d'une liste de vestiges.
 */

import { neverThrow, trace } from "./native";
import { appWindows, windowNumber, windowNumbers, findFreshWindow } from "./objcWindows";

/**
 * Classe de la fenêtre de mpv : `Window` de `video/out/mac/window.swift`, que le
 * préfixe de module fait apparaître ainsi. Vérifié sur mpv 0.41.0.
 */
export const MPV_WINDOW_CLASS = "swift.Window";

/**
 * Cadence du sondage, et nombre maximal de tentatives (10 s en tout).
 *
 * ⚠️ 10 ms, et non 100, mais pas pour gagner une course : mpv crée ET affiche sa
 * fenêtre dans un unique bloc sur le thread principal, où aucun minuteur ne peut
 * s'intercaler. La raison est qu'une lecture démarrée en plein écran n'affiche
 * PAS sa fenêtre (`macosWindowOptions.ts`) — c'est nous qui le faisons en
 * l'attachant, et ce délai est donc celui de la PREMIÈRE IMAGE.
 */
const POLL_MS = 10;
const POLL_MAX = 1000;

/** Les fenêtres mpv visibles à l'instant du relevé, à tenir pour des vestiges. */
export function mpvLeftovers(): ReadonlySet<number> {
  return windowNumbers(MPV_WINDOW_CLASS);
}

/** La fenêtre a-t-elle disparu ? On interroge AppKit, jamais mpv. */
export function windowGone(number: number): boolean {
  if (number === 0) return true;
  return !windowNumbers(MPV_WINDOW_CLASS).has(number);
}

/**
 * Cherche la fenêtre de mpv jusqu'à la trouver, et rend de quoi arrêter la
 * recherche — celle-ci doit cesser quand la lecture s'arrête, trouvée ou non.
 *
 * `leftovers` sont les fenêtres déjà là quand la recherche a commencé. Le cœur de
 * mpv se termine sur ses propres threads, après que la commande d'arrêt a rendu
 * la main, et sa fenêtre lui survit quelques instants : sans cette mémoire, un
 * changement d'épisode cale la vidéo sur une fenêtre morte.
 */
export function watchMpvWindow(
  leftovers: ReadonlySet<number>,
  found: (window: unknown, number: number) => void,
): () => void {
  let tries = 0;
  // ⚠️ Le tour ENTIER est protégé, rappel compris. Une exception qui s'échappe
  // d'un minuteur est fatale : Electron ouvre sa boîte « A JavaScript error
  // occurred » et le processus principal s'arrête là.
  const timer = setInterval(() => {
    neverThrow("recherche de la fenetre mpv", () => {
      const window = findFreshWindow(MPV_WINDOW_CLASS, leftovers);
      if (window !== null) {
        clearInterval(timer);
        found(window, windowNumber(window));
        return;
      }
      tries += 1;
      // Seul l'ÉCHEC est tracé, avec la liste des fenêtres : « mpv n'a créé
      // aucune fenêtre » et « elle existe mais nous échappe » demandent des
      // corrections opposées, et rien ne les distingue après coup.
      if (tries > POLL_MAX) {
        clearInterval(timer);
        trace(`fenetre mpv introuvable apres 10 s — ${appWindows()}`);
      }
    });
  }, POLL_MS);

  return () => clearInterval(timer);
}
