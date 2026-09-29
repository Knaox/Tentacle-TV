import { jellyfinAuthHeaders } from "./jellyfinAuth";
/**
 * Injection automatique des CORS hosts dans la configuration Jellyfin.
 * Permet au navigateur de faire du direct streaming sans erreur CORS.
 */

interface Logger {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
}

/**
 * Les origines à autoriser : celle de la page qui enregistre ET celle du lien
 * public. Jellyfin (mesuré en 10.11) ne répond au CORS que pour les origines
 * listées, `*` compris dans la liste. Enregistré depuis la maison, le lien
 * public manquait, et la lecture directe échouait dans tout navigateur venu
 * d'Internet. Une origine, pas une adresse : ni chemin, ni barre finale.
 */
export function corsOriginsToInject(requestOrigin: string | undefined, publicUrl: string | null): string[] {
  const origins = [requestOrigin, publicUrl].map((url) => {
    try {
      return url ? new URL(url).origin : null;
    } catch {
      return null;
    }
  });
  return [...new Set(origins.filter((origin): origin is string => origin !== null && origin !== "null"))];
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
  const headers = { ...jellyfinAuthHeaders(apiKey), "Content-Type": "application/json" };

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
