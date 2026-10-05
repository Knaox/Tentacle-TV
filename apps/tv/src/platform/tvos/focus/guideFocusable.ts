/**
 * Ce qu'un guide de focus déclare selon qu'il a une cible : sans cible,
 * NON focalisable — react-native-tvos marque sélectionnable tout guide dont
 * `destinations` est un tableau, même vide, et le guide retombé en simple
 * vue devenait une cible invisible (le pont du lecteur l'a payé :
 * `BridgeGuide`). Android TV a sa variante (`guideFocusable.android.ts`).
 * La seule règle de TOUS les guides : guides d'entrée, et ceux du lecteur
 * (`playerFocusContainers`).
 */
export function guideFocusable(hasTarget: boolean): false | undefined {
  return hasTarget ? undefined : false;
}
