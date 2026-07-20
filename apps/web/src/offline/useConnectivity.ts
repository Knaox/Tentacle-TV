/**
 * Accès React au store de connectivité. `useSyncExternalStore` plutôt qu'un
 * Context : l'état peut changer hors de tout rendu React (sondes, timers,
 * événements réseau du navigateur) — même choix que `useThemeMode`.
 */

import { useSyncExternalStore } from "react";
import {
  getConnectivitySnapshot,
  subscribeConnectivity,
  type ConnectivitySnapshot,
} from "./connectivityStore";

export function useConnectivity(): ConnectivitySnapshot {
  return useSyncExternalStore(subscribeConnectivity, getConnectivitySnapshot, getConnectivitySnapshot);
}
