import { fetch as undiciFetch } from "undici";
import { getJellyfinDispatcher } from "../../services/jellyfinHttpAgent";

/**
 * Le réglage du compte Jellyfin « Afficher les épisodes manquants dans les
 * saisons » (`Configuration.DisplayMissingEpisodes`) : coché, Jellyfin montre
 * partout les séries et saisons sans fichier — les « Derniers ajouts » de
 * Tentacle aussi (`planLatestCards`, `keepEmptyFolders`). Décoché (le défaut
 * de Jellyfin), un dossier vide n'y a pas de carte.
 *
 * Lu avec l'autorisation de la requête (le compte se lit lui-même, la clé
 * d'API lit tout compte), gardé une minute par compte : la rangée elle-même
 * est gardée 30 s. Le moindre accroc vaut le défaut de Jellyfin — décoché.
 */

const TTL_MS = 60_000;
const TIMEOUT_MS = 5_000;
const cache = new Map<string, { value: boolean; expires: number }>();

export async function displayMissingEpisodes(
  jellyfinUrl: string,
  userId: string,
  headers: Record<string, string>,
  now: number = Date.now(),
): Promise<boolean> {
  const hit = cache.get(userId);
  if (hit && hit.expires > now) return hit.value;
  let value = false;
  try {
    const response = await undiciFetch(`${jellyfinUrl}/Users/${encodeURIComponent(userId)}`, {
      headers,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      dispatcher: getJellyfinDispatcher(),
    });
    if (response.ok) {
      const body = (await response.json()) as { Configuration?: { DisplayMissingEpisodes?: unknown } } | null;
      value = body?.Configuration?.DisplayMissingEpisodes === true;
    } else {
      await response.body?.cancel();
    }
  } catch {
    // Jellyfin muet ou lent : le défaut, sans bloquer la rangée.
  }
  cache.set(userId, { value, expires: now + TTL_MS });
  return value;
}

/** Pour les tests : oublier ce qui a été lu. */
export function resetMissingEpisodesCache(): void {
  cache.clear();
}
