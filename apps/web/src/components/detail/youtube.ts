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
