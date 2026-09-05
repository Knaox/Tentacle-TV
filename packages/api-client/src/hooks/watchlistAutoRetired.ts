import { tentacleApiFetch } from "./usePreferences";

/** Ce qu'il faut du backend Tentacle — injectable, pour les tests. */
export interface BackendFetcher {
  fetch<T>(path: string, init?: RequestInit): Promise<T>;
}

export const AUTO_RETIRED_PATH = "/api/watchlist/auto-retired";

export const tentacleBackend: BackendFetcher = { fetch: tentacleApiFetch };

/**
 * Mémorise côté serveur un retrait AUTOMATIQUE de « Ma liste » (série
 * entièrement vue) : le serveur la remettra à l'arrivée d'un épisode. Jamais
 * bloquant — hors ligne ou sans backend (mode autonome), la série est sortie
 * de la liste et ne reviendra simplement pas d'elle-même.
 */
export async function recordAutoRetired(
  seriesId: string,
  backend: BackendFetcher = tentacleBackend,
): Promise<void> {
  await backend
    .fetch(AUTO_RETIRED_PATH, { method: "PUT", body: JSON.stringify({ seriesId }) })
    .catch(() => undefined);
}

/**
 * Oublie le suivi : l'utilisateur a repris la main (ajout ou retrait manuel,
 * import d'une liste partagée). Son geste prime, la série ne revient plus seule.
 */
export async function forgetAutoRetired(
  seriesId: string | undefined,
  backend: BackendFetcher = tentacleBackend,
): Promise<void> {
  if (!seriesId) return;
  await backend
    .fetch(`${AUTO_RETIRED_PATH}/${encodeURIComponent(seriesId)}`, { method: "DELETE" })
    .catch(() => undefined);
}
