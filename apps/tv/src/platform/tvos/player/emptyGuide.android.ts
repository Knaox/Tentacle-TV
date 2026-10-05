import type { FocusDestination } from "react-native";

/**
 * Android TV — voir `emptyGuide.ts`. Sur Android, `TVFocusGuideView` rend
 * `focusable` en `tvFocusable`, qui BLOQUE les descendants
 * (`FOCUS_BLOCK_DESCENDANTS`) — et la prop retirée retombe à faux, le
 * blocage reste : la croix de la feuille des pistes, l'écran de fin, le
 * message-outil devenaient inatteignables (mesuré à l'émulateur). Un guide
 * sans destination n'y est pas focalisable de lui-même : rien à poser.
 */
export function emptyGuideProps(_destinations: readonly FocusDestination[]): { focusable?: false } {
  return {};
}
