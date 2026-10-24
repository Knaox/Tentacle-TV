/**
 * Octave — la recherche HORS bibliothèque, progressive (point 1) : pour chaque
 * extension, la première page dès qu'elle arrive, puis la suivante par son
 * curseur tant que `complete` est faux (au plus `MAX_PAGES`). Une nouvelle
 * frappe annule tout ce qui est en vol. Les premiers titres sont annoncés à
 * l'extension (`prefetch("results")`).
 *
 * Sans extension musique : aucune requête, aucune section.
 */

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ExternalMusicSearchPage } from "@tentacle-tv/shared/music";
import { externalApi } from "../extension/externalApi";
import { providerSectionLabel, useMusicProviders, type MusicProvider } from "../extension/musicProviders";
import { useOctavePlayer } from "../player/OctavePlayerProvider";
import { appendPage, type ExternalSection } from "@tentacle-tv/shared/octave";

const MAX_PAGES = 6;
/** La frappe se pose : on n'interroge pas l'extension à chaque lettre. */
const TYPING_PAUSE_MS = 220;
const RESULTS_PREFETCHED = 3;

export function useExternalSearch(query: string): ExternalSection[] {
  const { t, i18n } = useTranslation("music");
  const providers = useMusicProviders();
  const player = useOctavePlayer();
  const [sections, setSections] = useState<ExternalSection[]>([]);
  const providersKey = providers.map((p) => p.pluginId).join(",");
  const providersRef = useRef<readonly MusicProvider[]>(providers);
  providersRef.current = providers;

  useEffect(() => {
    const q = query.trim();
    const active = providersRef.current;
    if (!q || active.length === 0) {
      setSections([]);
      return;
    }
    const controller = new AbortController();
    const initial = active.map<ExternalSection>((p) => ({
      pluginId: p.pluginId,
      label: providerSectionLabel(p, i18n.language, t("search.externalDefault")),
      tracks: [],
      albums: [],
      artists: [],
      complete: false,
    }));
    setSections(initial);

    const timer = setTimeout(() => {
      for (const provider of active) {
        void (async () => {
          let cursor: string | null = null;
          let announced = false;
          for (let page = 0; page < MAX_PAGES && !controller.signal.aborted; page += 1) {
            const result: ExternalMusicSearchPage | null = await externalApi.search(provider, q, cursor, controller.signal).catch(() => null);
            if (controller.signal.aborted) return;
            if (!result) {
              setSections((all) => all.map((s) => (s.pluginId === provider.pluginId ? { ...s, complete: true } : s)));
              return;
            }
            setSections((all) => all.map((s) => (s.pluginId === provider.pluginId ? appendPage(s, result) : s)));
            if (!announced && result.tracks.length > 0) {
              announced = true;
              player.prefetch(result.tracks.slice(0, RESULTS_PREFETCHED), "results");
            }
            if (result.complete || !result.cursor) return;
            cursor = result.cursor;
          }
          setSections((all) => all.map((s) => (s.pluginId === provider.pluginId ? { ...s, complete: true } : s)));
        })();
      }
    }, TYPING_PAUSE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, providersKey, i18n.language, player, t]);

  return sections;
}
