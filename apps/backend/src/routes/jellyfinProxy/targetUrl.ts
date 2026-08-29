/**
 * L'URL réellement demandée à Jellyfin.
 *
 * Deux corrections, l'une de sécurité, l'autre de compatibilité, toutes deux
 * silencieuses si elles ne s'appliquent pas. Extraites du handler du proxy, qui
 * était au-delà de ce qu'un fichier peut porter — et purs, donc enfin testables.
 */
export function buildTargetUrl(base: string, path: string, query: string): string {
  let url = `${base}/${path}${query}`;

  // La clé d'API ne doit pas franchir le proxy : l'authentification part en
  // en-tête `X-Emby-Token`. La laisser dans l'URL la sèmerait dans les journaux
  // du serveur et de tout ce qui se trouve en aval.
  try {
    const u = new URL(url);
    if (u.searchParams.has("api_key") || u.searchParams.has("ApiKey")) {
      u.searchParams.delete("api_key");
      u.searchParams.delete("ApiKey");
      url = u.toString();
    }
  } catch { /* URL inexploitable : on rend telle quelle */ }

  // Contournement d'un défaut de Jellyfin : son générateur de playlist
  // (DynamicHlsPlaylistGenerator) recopie toute la requête — y compris
  // `StartTimeTicks` — du `main.m3u8` dans l'URL de chaque segment, alors que
  // son propre gestionnaire de segments (GetDynamicSegment) refuse par un 400
  // tout `StartTimeTicks` supérieur à zéro.
  if (/\/hls1\//.test(path) && !path.endsWith(".m3u8")) {
    try {
      const u = new URL(url);
      u.searchParams.delete("StartTimeTicks");
      u.searchParams.delete("startTimeTicks");
      url = u.toString();
    } catch { /* URL inexploitable : on rend telle quelle */ }
  }

  return url;
}
