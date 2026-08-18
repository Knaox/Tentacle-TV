import { installerPolyfillDefilement } from "./polyfillScroll";
import { installerPolyfillAbort } from "./polyfillAbort";
import { installerPolyfillObservateurs } from "./polyfillObservers";

/**
 * Ce que core-js ne couvre pas.
 *
 * `@vitejs/plugin-legacy` embarque core-js, qui fournit les objets manquants
 * du **langage** — `Object.entries`, `padStart`, `flatMap`,
 * `Promise.allSettled`, `Array.at`, `globalThis`, `queueMicrotask`. Il ne
 * fournit rien du **DOM** : `AbortController`, `ResizeObserver` et
 * `Element.scrollBy` restent absents sur Chrome 53, et ce sont eux qui font la
 * différence entre une interface qui fonctionne et une pile de rangées vides.
 *
 * À installer avant tout : le premier rendu de React observe déjà des tailles
 * et le client d'API construit déjà des contrôleurs d'annulation.
 *
 * `Intl.DisplayNames` (Chrome 81) n'est délibérément pas polyfillé :
 * `localTrackLabels` enveloppe déjà son appel dans un `try`/`catch` et retombe
 * sur le code de langue. Les pistes s'afficheront « fre » plutôt que
 * « Français » sur les modèles les plus anciens — une dégradation lisible,
 * contre un dictionnaire bilingue à maintenir en double.
 */
export function installerPolyfills(): void {
  installerPolyfillAbort();
  installerPolyfillObservateurs();
  installerPolyfillDefilement();
}
