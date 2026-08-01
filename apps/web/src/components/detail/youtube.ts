import { isElectronShell, isTauriShell } from "../../desktop/bridge";
import { getBackendBase } from "../../lib/backendBase";

// parseYouTubeId vit dans packages/shared (réutilisé par la TV) — ré-export
// pour ne pas casser les imports existants.
export { parseYouTubeId } from "@tentacle-tv/shared";

/**
 * Source à donner à l'iframe pour lire `youtubeId`.
 *
 * Sur macOS desktop (Tauri/WKWebView), l'origine `tauri://` ne fournit aucun
 * referrer HTTP valide → YouTube renvoie l'erreur 153. On passe donc par une page
 * intermédiaire servie en HTTP(S) par le backend (`/yt-embed.html`) qui relaie
 * l'embed avec une origine valide. Ailleurs (web, Windows desktop où l'origine
 * est `http://tauri.localhost`), on garde l'embed direct.
 *
 * Electron passe par le relais QUELLE QUE SOIT la plateforme : son origine est
 * `tentacle://app`, un schéma applicatif exactement comme `tauri://`, donc sans
 * referrer HTTP non plus. Les conditions Tauri sont laissées intactes — l'app
 * Tauri livre encore macOS et Linux, elle ne doit rien voir changer.
 */
export function youtubeEmbedSrc(youtubeId: string): string {
  const direct = `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&autoplay=1`;
  if (typeof window === "undefined") return direct;
  const isMac = /mac/i.test(navigator.userAgent);
  if ((isTauriShell() && isMac) || isElectronShell()) {
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
 * Le mode dev macOS (Tauri présent mais top-level HTTP via Vite) garde l'embed
 * inline qui fonctionne.
 *
 * Electron n'est pas concerné : le relais lui suffit, Chromium transmettant
 * bien le referrer depuis l'iframe servie en HTTP.
 */
export function shouldOpenYouTubeExternally(): boolean {
  if (typeof window === "undefined") return false;
  const isMac = /mac/i.test(navigator.userAgent);
  return isTauriShell() && isMac && import.meta.env.PROD;
}
