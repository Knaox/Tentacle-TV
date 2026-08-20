import {
  creerMagasinCarteASuivre,
  creerMagasinDecompteEnchainement,
  creerUseReglageEnchainement,
} from "@tentacle-tv/tv-core";
import { tvStorage } from "../storage/RNStorageAdapter";

/**
 * Ce que le lecteur a le droit de faire à la fin d'un épisode, branché sur le
 * stockage natif.
 *
 * Mêmes magasins, mêmes clés et mêmes défauts que la LG et que l'ordinateur :
 * ne change ici que l'adaptateur. `RNStorageAdapter` convient tel quel — ses
 * lectures sont synchrones une fois `hydrate()` passé, comme `localStorage`.
 */

export const magasinCarteASuivre = creerMagasinCarteASuivre(tvStorage);
export const magasinDecompteEnchainement = creerMagasinDecompteEnchainement(tvStorage);

export const useCarteASuivre = creerUseReglageEnchainement(magasinCarteASuivre);
export const useDecompteEnchainement = creerUseReglageEnchainement(magasinDecompteEnchainement);
