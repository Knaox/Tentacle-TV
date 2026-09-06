import { useSyncExternalStore } from "react";
import {
  getConnectivitySnapshot,
  subscribeConnectivity,
  type ConnectivitySnapshot,
} from "./connectivityStore";

/** L'état de connectivité, réactif — le seul à lire dans les composants. */
export function useConnectivity(): ConnectivitySnapshot {
  return useSyncExternalStore(subscribeConnectivity, getConnectivitySnapshot, getConnectivitySnapshot);
}
