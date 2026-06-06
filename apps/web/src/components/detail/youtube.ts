/**
 * Extrait l'identifiant vidéo YouTube d'une URL de trailer distant Jellyfin.
 *
 * Gère les formats : `watch?v=`, `youtu.be/`, `embed/`, `v/`, `shorts/`, et le
 * format déprécié présent dans certains NFO :
 * `plugin://plugin.video.youtube/play/?video_id=ID` (cf. jellyfin issue #10869).
 *
 * Retourne `null` si l'URL n'est pas une URL YouTube reconnue (ex: Vimeo, lien
 * direct) — l'appelant retombe alors sur un lien externe brut.
 */
export function parseYouTubeId(url: string | undefined): string | null {
  if (!url) return null;

  // Format plugin Kodi/NFO : ...?video_id=ID
  const pluginMatch = url.match(/[?&]video_id=([\w-]{11})/);
  if (pluginMatch) return pluginMatch[1];

  const patterns = [
    /youtube\.com\/watch\?(?:.*&)?v=([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
    /youtube\.com\/embed\/([\w-]{11})/,
    /youtube\.com\/v\/([\w-]{11})/,
    /youtube\.com\/shorts\/([\w-]{11})/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}
