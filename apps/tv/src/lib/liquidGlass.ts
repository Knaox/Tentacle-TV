import { useSyncExternalStore } from "react";
import { createBooleanStore } from "@tentacle-tv/shared";
import { LIQUID_GLASS_STORAGE_KEY } from "../redesign/glass/liquidGlassMode";
import { tvStorage } from "../storage/RNStorageAdapter";

/**
 * Le réglage « Liquid Glass » de ce téléviseur : un réglage d'APPAREIL, comme
 * sur le bureau et le mobile — même clé (`tentacle_liquid_glass`, traversée
 * par une chaîne : ne jamais la renommer), mêmes valeurs (« true » /
 * « false »), activé par défaut.
 *
 * Les vues de la refonte ne lisent pas le stockage : `App.tsx` monte
 * `LiquidGlassProvider` sur ce magasin, l'onglet Apparence des réglages
 * l'écrit, et tout le verre de l'écran change aussitôt.
 */
export const liquidGlassStore = createBooleanStore(tvStorage, LIQUID_GLASS_STORAGE_KEY, true);

export function useLiquidGlass(): boolean {
  return useSyncExternalStore(
    liquidGlassStore.subscribe,
    liquidGlassStore.readSnapshot,
    liquidGlassStore.readSnapshot,
  );
}
