import { createRailPinningStore, createUseRailPinning } from "@tentacle-tv/tv-core";
import { tvStorage } from "../../storage/RNStorageAdapter";

/**
 * Le rail natif, branché sur le magasin d'épinglage partagé.
 *
 * Même politique et même clé de stockage que la LG : liste d'exclusion, tout
 * visible par défaut, « Tout afficher » pour revenir en arrière. Ne change ici
 * que le stockage.
 *
 * `RNStorageAdapter` convient tel quel — ses lectures sont synchrones une fois
 * `hydrate()` passé, comme `localStorage`. C'est ce qui permet au magasin
 * d'être exactement le même code sur les trois cibles.
 */
export const railPinningStore = createRailPinningStore(tvStorage);

export const useRailPinning = createUseRailPinning(railPinningStore);
