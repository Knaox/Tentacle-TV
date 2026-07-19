/**
 * Mode Hors ligne APPLICATIF (desktop uniquement) : vrai quand l'app doit
 * basculer sur le contenu local — hors ligne automatique OU manuel.
 * Sur le web, toujours false (l'overlay bloquant existant garde son rôle).
 */

import { isTauriApp } from "../main";
import { useConnectivity } from "./useConnectivity";

export function useOfflineMode(): boolean {
  const { state } = useConnectivity();
  return isTauriApp && (state === "offline-auto" || state === "offline-manual");
}
