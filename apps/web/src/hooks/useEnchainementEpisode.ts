/** Accès React aux deux réglages de fin d'épisode. */

import { useSyncExternalStore } from "react";

import {
  magasinCarteASuivre,
  magasinDecompteEnchainement,
} from "../lib/enchainementEpisode";

/** La petite carte « à suivre » du générique est-elle proposée ? */
export function useCarteASuivre(): boolean {
  return useSyncExternalStore(
    magasinCarteASuivre.sAbonner,
    magasinCarteASuivre.lireInstantane,
    magasinCarteASuivre.lireInstantane,
  );
}

/** Le lecteur a-t-il le droit d'enchaîner tout seul, décompte à l'appui ? */
export function useDecompteEnchainement(): boolean {
  return useSyncExternalStore(
    magasinDecompteEnchainement.sAbonner,
    magasinDecompteEnchainement.lireInstantane,
    magasinDecompteEnchainement.lireInstantane,
  );
}
