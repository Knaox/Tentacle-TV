import { api } from "./api-client";
import { hosts } from "./record";

/**
 * Le direct des demandes Vigie, hors de ce que T6 a touché : éteint au banc.
 * Le scénario pose les titres arrivés (`api.arrivals`) et l'app au premier
 * plan ou non (`api.appActive`) ; `useLiveRefresh` inscrit seulement ce qu'on
 * lui demande (`hosts` « liveRefresh »).
 */
export const useLiveRefresh = (_gate: unknown, active: boolean) => {
  hosts.set("liveRefresh", { active });
};
export const useArrivals = () => new Set<string>((api.arrivals as string[] | undefined) ?? []);
export const useJustArrived = () => new Set<string>();
export const useAppActive = () => api.appActive !== false;
