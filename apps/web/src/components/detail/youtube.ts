import { getBackendBase } from "../../lib/backendBase";

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

/**
 * Source à donner à l'iframe pour lire `youtubeId`.
 *
 * Sur macOS desktop (Tauri/WKWebView), l'origine `tauri://` ne fournit aucun
 * referrer HTTP valide → YouTube renvoie l'erreur 153. On passe donc par une page
 * intermédiaire servie en HTTP(S) par le backend (`/yt-embed.html`) qui relaie
 * l'embed avec une origine valide. Ailleurs (web, Windows desktop où l'origine
 * est `http://tauri.localhost`), on garde l'embed direct.
 */
export function youtubeEmbedSrc(youtubeId: string): string {
  const direct = `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&autoplay=1`;
  if (typeof window === "undefined") return direct;
  const isTauri = "__TAURI_INTERNALS__" in window;
  const isMac = /mac/i.test(navigator.userAgent);
  if (isTauri && isMac) {
    const backend = getBackendBase().replace(/\/$/, "");
    if (backend) return `${backend}/yt-embed.html?v=${youtubeId}`;
  }
  return direct;
}

/**
 * DMG macOS : limitation fondamentale WKWebView + frame racine `tauri://`,
 * le Referer est stripé pour TOUTES les requêtes des frames descendants, peu
 * importe `Referrer-Policy`, l'attribut iframe ou `&origin=` (cf. tauri#14422,
 * #14278). Aucune page intermédiaire ne peut le corriger → sur macOS DMG on
 * ouvre directement la bande-annonce dans le navigateur système.
 *
 * Le mode dev macOS (`__TAURI_INTERNALS__` présent mais top-level HTTP via Vite)
 * garde l'embed inline qui fonctionne.
 */
export function shouldOpenYouTubeExternally(): boolean {
  if (typeof window === "undefined") return false;
  const isTauri = "__TAURI_INTERNALS__" in window;
  const isMac = /mac/i.test(navigator.userAgent);
  return isTauri && isMac && import.meta.env.PROD;
}
