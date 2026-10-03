/**
 * La prise du pan vit désormais dans l'entrée unique de la télécommande
 * (`platform/tvos/input/panGesture.ts`). Ce chemin reste le temps que ses
 * importateurs (le lecteur : `hooks/useScrubGestures.ios.ts`) migrent.
 */
export { acquirePanGesture, usePanGesture } from "../platform/tvos/input/panGesture";
