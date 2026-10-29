/**
 * Le champ optionnel `music` d'un manifeste d'extension (`plugin.json`) : les
 * points d'extension de la musique (recherche, source de lecture, gestes, en
 * attente), relayés aux clients par `/api/plugins/active`, comme `search` et
 * `titles` (pluginSearchMeta.ts, pluginTitlesMeta.ts). Contrat :
 * `packages/shared/src/music/pluginMusicContract.ts` (docs/octave/CONTRATS.md).
 *
 * MIROIR : à partir de `const SAFE_PATH`, ce fichier est l'octet pour octet la
 * lecture de shared (`readPluginMusicManifest`) — le backend ne dépend pas de
 * `@tentacle-tv/shared` (test : plugins/runtime/runtimeMirror.test.ts). On
 * modifie là-bas, on recopie ici. Au-dessus, la seule forme dont le cœur a
 * besoin, sans les types des titres.
 */

import type { MusicImportSource } from "../music/contract/musicImport";

export interface PluginMusicManifest {
  search: string;
  resolve: string;
  prefetch?: string;
  prefetchAlbums?: boolean;
  like?: string;
  playlistAdd?: string;
  pending?: string;
  played?: string;
  album?: string;
  artist?: string;
  suggest?: string;
  playlist?: string;
  radio?: string;
  typingPause?: string;
  rights?: string;
  offline?: string;
  moods?: string;
  mood?: string;
  importRead?: string;
  importSources?: MusicImportSource[];
  importTracks?: string;
  releases?: string;
  releaseSources?: ("bandcamp" | "files")[];
  searchKinds?: ("tracks" | "albums" | "artists" | "playlists")[];
  labels?: Record<string, string>;
}

/* ── Lecture du manifeste (même garde que `search` et `titles`) ── */

const SAFE_PATH = /^\/[A-Za-z0-9_\-/]{1,100}$/;

function safePath(value: unknown): string | undefined {
  return typeof value === "string" && SAFE_PATH.test(value) && !value.includes("//") ? value : undefined;
}

/** Le contrat `music` d'un manifeste, validé ; `null` si absent ou sans `search` ET `resolve` valides. */
export function readPluginMusicManifest(raw: unknown): PluginMusicManifest | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  const search = safePath(m.search);
  const resolve = safePath(m.resolve);
  if (!search || !resolve) return null;
  const out: PluginMusicManifest = { search, resolve };
  for (const key of ["prefetch", "like", "playlistAdd", "pending", "played", "album", "artist", "suggest", "playlist", "radio", "typingPause", "rights", "offline", "moods", "mood", "importRead", "importTracks", "releases"] as const) {
    const path = safePath(m[key]);
    if (path) out[key] = path;
  }
  if (m.prefetchAlbums === true && out.prefetch) out.prefetchAlbums = true;
  if (Array.isArray(m.searchKinds)) {
    const kinds = ["tracks", "albums", "artists", "playlists"].filter((k) => (m.searchKinds as unknown[]).includes(k));
    if (kinds.length > 0) out.searchKinds = kinds as NonNullable<PluginMusicManifest["searchKinds"]>;
  }
  if (Array.isArray(m.importSources)) {
    const sources = ["spotify", "apple", "deezer", "youtube"].filter((k) => (m.importSources as unknown[]).includes(k));
    if (sources.length > 0) out.importSources = sources as MusicImportSource[];
  }
  if (Array.isArray(m.releaseSources)) {
    const sources = ["bandcamp", "files"].filter((k) => (m.releaseSources as unknown[]).includes(k));
    if (sources.length > 0) out.releaseSources = sources as NonNullable<PluginMusicManifest["releaseSources"]>;
  }
  if (m.labels && typeof m.labels === "object") {
    const labels: Record<string, string> = {};
    for (const [lang, text] of Object.entries(m.labels as Record<string, unknown>)) {
      if (/^[a-z]{2}$/.test(lang) && typeof text === "string" && text.length <= 60) labels[lang] = text;
    }
    out.labels = labels;
  }
  return out;
}
