import type { ScrubGestureHandlers } from "./scrubGestureTypes";

export type { ScrubGestureHandlers, ScrubDir } from "./scrubGestureTypes";

/**
 * Scrub gestuel — variante **Android TV** : no-op.
 * Sur Android, l'avance/recul rapide arrive via les events télécommande natifs
 * (`longLeft`/`longRight`, `rewind`/`fastForward` émis nativement par
 * react-native-tvos) déjà traités par useTVRemote → aucun geste à synthétiser
 * ici. La variante tvOS (`useScrubGestures.ios.ts`) alimente ces mêmes
 * comportements depuis les gestes pan de la Siri Remote.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScrubGestures(_handlers: ScrubGestureHandlers): void {
  // intentionnellement vide (cf. doc ci-dessus)
}
