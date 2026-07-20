/**
 * Politique réseau poussée par l'application — même inversion de dépendance
 * que `net/dataSaver.ts` : `api-client` ne connaît ni la plateforme ni la
 * connectivité ; l'app pousse, mobile/TV ne poussent rien → défauts intacts.
 *
 * Deux leviers, consommés par `jellyfin/fetchWithRetry.ts` :
 * - le TIMEOUT par tentative, exposé en FONCTION (relu à chaque tentative,
 *   jamais figé à la définition d'un hook) ;
 * - un signal de SUSPICION réseau, émis dès la première tentative en échec
 *   sans attendre la fin de l'échelle de retries — l'app y branche sa sonde
 *   de connectivité (throttlée côté app, aucun débounce ici).
 */

/** 30 s : borne historique des vrais hangs (cf. fetchWithRetry). Le desktop
 *  pousse 12 s — un poste avec catalogue local préfère échouer vite. */
let timeoutMs = 30_000;

export function requestTimeoutMs(): number {
  return timeoutMs;
}

export function setRequestTimeoutMs(ms: number): void {
  timeoutMs = ms;
}

let suspectListener: (() => void) | null = null;

/** Branché par l'app (store de connectivité) ; `null` pour débrancher. */
export function setNetworkSuspectListener(listener: (() => void) | null): void {
  suspectListener = listener;
}

/** Appelé par la couche fetch à chaque tentative en échec réseau/timeout. */
export function reportNetworkSuspect(): void {
  suspectListener?.();
}
