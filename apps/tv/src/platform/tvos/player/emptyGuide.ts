import type { FocusDestination } from "react-native";

/**
 * Ce que porte un guide de focus du lecteur tant qu'il n'a pas de destination
 * (Apple TV) : react-native-tvos rend sélectionnable tout guide dont
 * `destinations` est un tableau, même vide — retombé en simple vue, il
 * devenait FOCALISABLE (mesuré : « haut » depuis les commandes posait le
 * focus sur la frise, invisible). `focusable` faux le tait. Le jumeau
 * d'Android TV : `emptyGuide.android.ts`.
 */
export function emptyGuideProps(destinations: readonly FocusDestination[]): { focusable?: false } {
  return destinations.length > 0 ? {} : { focusable: false };
}
