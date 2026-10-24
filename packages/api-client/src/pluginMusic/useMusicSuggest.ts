/**
 * Octave — les SUGGESTIONS de l'extension pendant la frappe (`music.suggest`) :
 * ses index locaux, aucune requête réseau de sa part. Anti-rebond court, la
 * frappe dépassée annulée (le signal de TanStack va jusqu'à `fetch`), la
 * réponse précédente gardée entre deux lettres. Rien sans la capacité serveur
 * `music.suggest` ni sans la route déclarée par l'extension : la barre garde
 * alors la bibliothèque et les recherches récentes.
 */

import { useQuery } from "@tanstack/react-query";
import type { MusicSuggestion } from "@tentacle-tv/shared/music";
import { useServerCapability } from "../hooks/useServerCapabilities";
import { tentacleApiFetch } from "../hooks/usePreferences";
import { KEEP_PREVIOUS } from "../music/musicQueryKeys";
import { musicSearchText, useDebouncedText } from "../music/useMusicSearch";
import { musicRouteUrl, type MusicProvider } from "./musicProvider";

const MIN_QUERY = 2;
const KINDS = new Set(["track", "artist", "album"]);

/** Une réponse d'extension n'est crue que suggestion par suggestion. */
export function readMusicSuggestions(raw: unknown): MusicSuggestion[] {
  const list = (raw as { suggestions?: unknown } | null)?.suggestions;
  if (!Array.isArray(list)) return [];
  const out: MusicSuggestion[] = [];
  for (const item of list) {
    const s = item as Partial<MusicSuggestion> | null;
    if (!s || typeof s.title !== "string" || typeof s.text !== "string" || !KINDS.has(String(s.kind))) continue;
    out.push({ kind: s.kind as MusicSuggestion["kind"], title: s.title.slice(0, 200), subtitle: typeof s.subtitle === "string" ? s.subtitle.slice(0, 200) : null, text: s.text.slice(0, 200) });
  }
  return out.slice(0, 20);
}

export function useMusicSuggest(provider: MusicProvider | null, raw: string, options: { limit?: number; debounceMs?: number } = {}): MusicSuggestion[] {
  const capable = useServerCapability("music.suggest");
  const route = provider?.music.suggest ?? null;
  const limit = options.limit ?? 8;
  const q = useDebouncedText(musicSearchText(raw), options.debounceMs ?? 90);
  const enabled = capable && !!provider && !!route && q.length >= MIN_QUERY;
  const result = useQuery({
    queryKey: ["music", "external-suggest", provider?.pluginId ?? null, route, q, limit],
    queryFn: async ({ signal }) => {
      if (!provider || !route) return [];
      return readMusicSuggestions(await tentacleApiFetch<unknown>(musicRouteUrl(provider, route, { q, limit }), { signal }));
    },
    enabled,
    staleTime: 5 * 60_000,
    retry: false,
    ...KEEP_PREVIOUS,
  });
  return enabled ? (result.data ?? []) : [];
}
