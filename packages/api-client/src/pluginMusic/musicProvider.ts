/**
 * Le FOURNISSEUR de musique hors bibliothèque : une extension active,
 * configurée, qui déclare le contrat `music` (`readPluginMusicManifest`,
 * shared) — trouvée dans la liste `/api/plugins/active` que chaque application
 * tient déjà. Le cœur n'en connaît pas le nom : la première qui répond au
 * contrat sert. Règles PURES (sans React), testées seules.
 */

import { readPluginMusicManifest, type MusicCapablePlugin, type PluginMusicManifest } from "@tentacle-tv/shared/music";

export interface MusicProvider {
  pluginId: string;
  name: string;
  music: PluginMusicManifest;
}

/** La liste `/api/plugins/active` arrive telle quelle : on n'en croit que ce que le contrat valide. */
export function findMusicProvider(plugins: readonly MusicCapablePlugin[] | null | undefined): MusicProvider | null {
  for (const plugin of plugins ?? []) {
    if (plugin.configEnabled !== true) continue;
    const music = readPluginMusicManifest(plugin.music);
    if (music) return { pluginId: plugin.pluginId, name: plugin.name, music };
  }
  return null;
}

/** L'URL (chemin du serveur Tentacle) d'une route de l'extension, avec ses paramètres. */
export function musicRouteUrl(provider: MusicProvider, path: string, query?: Record<string, string | number | null | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== null && value !== undefined && value !== "") params.set(key, String(value));
  }
  const qs = params.toString();
  return `/api/plugins/${encodeURIComponent(provider.pluginId)}${path}${qs ? `?${qs}` : ""}`;
}

/** Le nom de la section de recherche dans la langue de l'interface, sinon celui de repli. */
export function musicSectionLabel(provider: MusicProvider, lang: string, fallback: string): string {
  const labels = provider.music.labels ?? {};
  return labels[lang.slice(0, 2)] ?? labels.en ?? fallback;
}
