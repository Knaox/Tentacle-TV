/**
 * Ce qui réveille le sondeur : le retour au premier plan, et les changements
 * de réseau du téléphone.
 *
 * Sorti du magasin, qui touchait ses 300 lignes. La subtilité vaut d'être
 * relue : un « aucun réseau » d'un ÉVÈNEMENT passe par un délai de grâce — un
 * relais Wi-Fi ↔ cellulaire en produit un au passage —, alors que la lecture
 * INITIALE est prise pour vérité immédiate : au démarrage, rien n'a encore
 * relayé quoi que ce soit.
 */

import { AppState, type AppStateStatus } from "react-native";
import { preferDefaultNetwork } from "@tentacle-tv/offline-core";
import { publicLog } from "../../modules/offline-storage/publicLog";
import { defaultNetworkKind, onDefaultNetworkChange } from "../../modules/offline-storage/defaultNetwork";
import { isLinkLost, mapNetworkType, Network, type NetworkState, type NetworkType } from "./networkState";

export interface NetworkHandlers {
  /** Le réseau du téléphone a changé de nature (Wi-Fi, cellulaire, aucun…). */
  onType: (type: NetworkType) => void;
  /** Plus de lien du tout. `graced` : passer par le délai anti-relais. */
  onLinkLost: (graced: boolean) => void;
  /** Le lien est là : annuler un délai en cours. */
  onLinkBack: () => void;
  /** Le réseau a bougé et le lien tient : sonder tout de suite. */
  onNetworkChange: () => void;
  /** Retour au premier plan. */
  onForeground: () => void;
}

/** Pose les écouteurs ; rend leur nettoyage. */
export function startNetworkListeners(handlers: NetworkHandlers): () => void {
  const appState = AppState.addEventListener("change", (status: AppStateStatus) => {
    if (status === "active") handlers.onForeground();
  });

  // Android : le réseau PAR DÉFAUT suivi par le module l'emporte sur le type
  // d'expo-network, relu trop tôt à l'arrivée du Wi-Fi (`wifiOnlyRule.ts`).
  let lastType: NetworkType | null = null;
  const settleType = (type: NetworkType): void => {
    if (type !== lastType) publicLog("transferts", `réseau : ${type}`);
    lastType = type;
    handlers.onType(type);
  };
  const stopDefault = onDefaultNetworkChange((type) => settleType(preferDefaultNetwork(type, lastType ?? "unknown")));

  let network: { remove(): void } | null = null;
  if (Network !== null) {
    const apply = (state: NetworkState, fromListener: boolean): void => {
      settleType(preferDefaultNetwork(defaultNetworkKind(), mapNetworkType(state)));
      if (isLinkLost(state)) {
        handlers.onLinkLost(fromListener);
        return;
      }
      handlers.onLinkBack();
      if (fromListener) handlers.onNetworkChange();
    };
    Network.getNetworkStateAsync()
      .then((state) => apply(state, false))
      // Sans réponse d'expo-network, le réseau vaut « autre » plutôt que
      // « inconnu » : « inconnu » retient les transferts sous Wi-Fi seulement.
      .catch(() => settleType(preferDefaultNetwork(defaultNetworkKind(), "other")));
    network = Network.addNetworkStateListener((state) => apply(state, true));
  } else {
    settleType(preferDefaultNetwork(defaultNetworkKind(), "other"));
  }

  return () => {
    appState.remove();
    network?.remove();
    stopDefault();
  };
}
