import { isDesktopApp } from "../desktop/bridge";

/**
 * Base URL du backend Tentacle — source unique de vérité, alignée sur le
 * `backendUrl` canonique de `main.tsx`.
 *
 * - Web : chaîne vide → les fetch restent relatifs same-origin (`/api/...`).
 * - Bureau : URL serveur Tentacle sauvegardée (`tentacle_server_url`).
 *
 * À utiliser partout où une route backend (`/api/...`) est appelée hors du
 * client Jellyfin, pour éviter le fallback `window.location.origin` qui pointe
 * vers l'origine applicative du bureau et casse l'appel.
 *
 * ⚠️ La garde porte sur `isDesktopApp()`, JAMAIS sur la présence de Tauri.
 * Elle a longtemps interrogé `__TAURI_INTERNALS__` directement : sous Electron
 * la réponse était non, la base retombait sur la chaîne vide, et chaque
 * `/api/...` était résolu contre `tentacle://app` — où le repli monopage
 * répondait `index.html` en HTTP 200. Aucun appel n'échouait, aucun ne
 * réussissait, et l'application restait muette sur une page noire.
 */
export function getBackendBase(): string {
  if (isDesktopApp()) return localStorage.getItem("tentacle_server_url") || "";
  return import.meta.env.VITE_BACKEND_URL || "";
}
