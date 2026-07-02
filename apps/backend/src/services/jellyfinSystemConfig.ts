import { getJellyfinApiKey, getJellyfinUrl } from "./configStore";

/** Défaut Jellyfin quand la config est injoignable ou le champ absent. */
const DEFAULT_MAX_RESUME_PCT = 90;
/** TTL court : un changement dans Jellyfin est visible en ≤ 30 s côté serveur,
 *  sans jamais dépasser ~2 requêtes/min vers Jellyfin quel que soit le nombre
 *  de clients qui pollent /api/config/autoplay. */
const TTL_MS = 30_000;

let cached: { value: number; expiresAt: number } | null = null;

/**
 * `MaxResumePct` de la configuration système Jellyfin (« pourcentage maximal
 * de reprise ») — seuil (%) au-delà duquel un média est considéré comme vu.
 * Sert de point de déclenchement de la bannière « épisode suivant » sur toutes
 * les plateformes. Lu avec la clé API admin (backend uniquement), cache
 * mémoire 30 s + conservation de la dernière valeur connue en cas d'échec
 * réseau (stale-on-error).
 */
export async function getMaxResumePct(): Promise<number> {
  if (cached && Date.now() < cached.expiresAt) return cached.value;

  const url = getJellyfinUrl();
  const apiKey = getJellyfinApiKey();
  if (!url || !apiKey) return cached?.value ?? DEFAULT_MAX_RESUME_PCT;

  try {
    const res = await fetch(`${url}/System/Configuration`, {
      headers: { "X-Emby-Token": apiKey },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { MaxResumePct?: number };
    const pct = typeof data.MaxResumePct === "number" && data.MaxResumePct > 0 && data.MaxResumePct <= 100
      ? data.MaxResumePct
      : DEFAULT_MAX_RESUME_PCT;
    cached = { value: pct, expiresAt: Date.now() + TTL_MS };
    return pct;
  } catch {
    // Jellyfin injoignable : servir la dernière valeur connue (re-tentera au
    // prochain appel), sinon le défaut.
    return cached?.value ?? DEFAULT_MAX_RESUME_PCT;
  }
}
