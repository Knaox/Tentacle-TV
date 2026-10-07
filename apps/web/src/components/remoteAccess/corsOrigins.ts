/** Les origines des coquilles de bureau (Electron, ancienne coquille Tauri), dites d'un seul mot. */
const DESKTOP_ORIGINS = new Set(["tentacle://app", "tauri://localhost", "https://tauri.localhost", "http://tauri.localhost"]);

/**
 * Les origines que Tentacle inscrit dans Jellyfin, lisibles : les adresses
 * telles quelles, les quatre origines des applications de bureau en une seule
 * mention (`desktopLabel`).
 */
export function readableOrigins(origins: readonly string[], desktopLabel: string): string[] {
  const out = origins.filter((origin) => !DESKTOP_ORIGINS.has(origin));
  return origins.some((origin) => DESKTOP_ORIGINS.has(origin)) ? [...out, desktopLabel] : out;
}
