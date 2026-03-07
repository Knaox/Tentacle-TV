/**
 * Injection automatique des CORS hosts dans la configuration Jellyfin.
 * Permet au navigateur de faire du direct streaming sans erreur CORS.
 */

interface Logger {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
}

/**
 * Injecte les URLs Tentacle dans les CorsHosts de Jellyfin si absentes.
 * Non-bloquant : les erreurs sont loguées mais ne remontent pas.
 */
export async function injectCorsHosts(
  jellyfinUrl: string,
  apiKey: string,
  tentacleUrls: string[],
  logger?: Logger,
): Promise<{ added: string[]; alreadyPresent: string[] }> {
  const headers = { "X-Emby-Token": apiKey, "Content-Type": "application/json" };

  // 1. Récupérer la config actuelle
  const res = await fetch(`${jellyfinUrl}/System/Configuration`, {
    headers,
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Jellyfin GET config responded ${res.status}`);
  const config = await res.json();

  // 2. Extraire et normaliser les CorsHosts existants
  const existing: string[] = Array.isArray(config.CorsHosts) ? config.CorsHosts : [];
  const normalize = (u: string) => u.trim().replace(/\/$/, "").toLowerCase();
  const existingNorm = new Set(existing.map(normalize));

  // 3. Filtrer les URLs à injecter
  const added: string[] = [];
  const alreadyPresent: string[] = [];

  for (const raw of tentacleUrls) {
    const url = raw.trim().replace(/\/$/, "");
    if (!url.startsWith("http://") && !url.startsWith("https://")) continue;
    if (url.includes("*")) continue;

    if (existingNorm.has(normalize(url))) {
      alreadyPresent.push(url);
    } else {
      added.push(url);
    }
  }

  // 4. Limiter à 10 CorsHosts total
  const toAdd = added.slice(0, Math.max(0, 10 - existing.length));

  if (toAdd.length === 0) return { added: [], alreadyPresent };

  // 5. Sauvegarder la config mise à jour
  config.CorsHosts = [...existing, ...toAdd];
  const postRes = await fetch(`${jellyfinUrl}/System/Configuration`, {
    method: "POST",
    headers,
    body: JSON.stringify(config),
    signal: AbortSignal.timeout(5000),
  });
  if (!postRes.ok) throw new Error(`Jellyfin POST config responded ${postRes.status}`);

  logger?.info({ added: toAdd }, "CORS hosts injected into Jellyfin");

  return { added: toAdd, alreadyPresent };
}
