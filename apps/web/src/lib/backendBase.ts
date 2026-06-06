const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/**
 * Base URL du backend Tentacle — source unique de vérité, alignée sur le
 * `backendUrl` canonique de `main.tsx`.
 *
 * - Web : chaîne vide → les fetch restent relatifs same-origin (`/api/...`).
 * - Desktop (Tauri) : URL serveur Tentacle sauvegardée (`tentacle_server_url`).
 *
 * À utiliser partout où une route backend (`/api/...`) est appelée hors du
 * client Jellyfin, pour éviter le fallback `window.location.origin` qui pointe
 * vers `tauri://`/`tauri.localhost` sur desktop et casse l'appel.
 */
export function getBackendBase(): string {
  if (isTauri) return localStorage.getItem("tentacle_server_url") || "";
  return import.meta.env.VITE_BACKEND_URL || "";
}
