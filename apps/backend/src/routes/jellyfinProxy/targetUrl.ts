/**
 * L'URL réellement demandée à Jellyfin.
 *
 * Deux corrections, l'une de sécurité, l'autre de compatibilité, toutes deux
 * silencieuses si elles ne s'appliquent pas. Extraites du handler du proxy, qui
 * était au-delà de ce qu'un fichier peut porter — et purs, donc enfin testables.
 */
export function buildTargetUrl(base: string, path: string, query: string): string {
  let url = `${base}/${path}${query}`;

  // Le jeton ne franchit pas le proxy dans l'URL : l'authentification part en
  // en-tête `Authorization: MediaBrowser`. Le laisser dans l'URL le sèmerait
  // dans les journaux du serveur et de tout ce qui se trouve en aval. Toutes
  // les casses : Jellyfin lit `ApiKey` sans égard à la sienne.
  try {
    const u = new URL(url);
    const keys = [...u.searchParams.keys()].filter((k) => /^(api_key|apikey)$/i.test(k));
    if (keys.length > 0) {
      for (const k of keys) u.searchParams.delete(k);
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
