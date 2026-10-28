/**
 * Octave mobile — la SOURCE d'une pochette, règle PURE (`artworkSource.test.ts`) :
 * - le cache disque d'`expo-image` est rangé par une clé SANS jeton (`api_key`,
 *   `ApiKey`, `X-Emby-Token`, `token`) : une session renouvelée, ou un démarrage
 *   hors ligne, retrouve les pochettes déjà vues au lieu d'une case vide ;
 * - hors ligne, la pochette GARDÉE sur l'appareil avec le titre (`coverRel` du
 *   moteur) passe avant l'adresse du serveur — elle ne dépend d'aucun cache.
 */

const TOKEN_PARAMS = new Set(["api_key", "apikey", "x-emby-token", "token"]);

export function artworkCacheKey(src: string): string {
  const q = src.indexOf("?");
  if (q < 0) return src;
  const hashAt = src.indexOf("#", q);
  const query = src.slice(q + 1, hashAt < 0 ? undefined : hashAt);
  const kept = query.split("&").filter((part) => part !== "" && !TOKEN_PARAMS.has(decodeURIComponent(part.split("=")[0] ?? "").toLowerCase()));
  return kept.length > 0 ? `${src.slice(0, q)}?${kept.join("&")}` : src.slice(0, q);
}

export interface ArtworkImageSource {
  uri: string;
  cacheKey?: string;
}

export function artworkSource(remote: string | null, local: string | null, offline: boolean): ArtworkImageSource | null {
  if (local && (offline || !remote)) return { uri: local };
  if (!remote) return null;
  // Un fichier local, une adresse de données : leur adresse EST leur clé.
  if (!/^https?:\/\//i.test(remote)) return { uri: remote };
  return { uri: remote, cacheKey: artworkCacheKey(remote) };
}
