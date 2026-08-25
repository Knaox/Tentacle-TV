import { isElectronShell } from "../../desktop/bridge";
import { getBackendBase } from "../../lib/backendBase";

// parseYouTubeId vit dans packages/shared (réutilisé par la TV) — ré-export
// pour ne pas casser les imports existants.
export { parseYouTubeId } from "@tentacle-tv/shared";

/**
 * Source à donner à l'iframe pour lire `youtubeId`.
 *
 * L'origine de la coquille est `tentacle://app`, un schéma applicatif : il ne
 * fournit aucun referrer HTTP valide, et YouTube renvoie l'erreur 153. On passe
 * donc par une page intermédiaire servie en HTTP(S) par le backend
 * (`/yt-embed.html`), qui relaie l'embed avec une origine valide. Sur le web, où
 * l'origine est déjà une vraie origine HTTP, l'embed direct suffit.
 */
export function youtubeEmbedSrc(youtubeId: string): string {
  const direct = `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&autoplay=1`;
  if (typeof window === "undefined") return direct;
  if (isElectronShell()) {
    const backend = getBackendBase().replace(/\/$/, "");
    if (backend) return `${backend}/yt-embed.html?v=${youtubeId}`;
  }
  return direct;
}

/**
 * Faut-il ouvrir la bande-annonce dans le navigateur du système ?
 *
 * Plus jamais, et c'est une bonne nouvelle. Le cas venait du DMG macOS sous
 * Tauri : WKWebView avec une frame racine en `tauri://` stripait le Referer de
 * TOUTES les requêtes des frames descendants, quels que soient
 * `Referrer-Policy`, l'attribut iframe ou `&origin=` (tauri#14422, #14278), et
 * aucune page intermédiaire ne pouvait le corriger.
 *
 * Chromium, lui, transmet le referrer depuis l'iframe servie en HTTP : le relais
 * suffit sur les trois systèmes. La fonction est gardée — les appelants la
 * consultent — et répond simplement non.
 */
export function shouldOpenYouTubeExternally(): boolean {
  return false;
}
