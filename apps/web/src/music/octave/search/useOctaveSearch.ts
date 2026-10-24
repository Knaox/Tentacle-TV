/**
 * Octave — la recherche : la BIBLIOTHÈQUE d'abord (`useMusicSearch`, A3 :
 * anti-rebond, annulation, réponse précédente gardée), puis la section de
 * l'extension, progressive (`usePluginMusicSearch`, A5 : pages par curseur,
 * fusion par clé). La bibliothèque gagne : un enregistrement qu'elle a — dans
 * ses résultats, ou ailleurs (`useMusicByMbid`, A3) — est retiré de la section.
 * Les premiers titres externes sont annoncés à l'extension (`prefetch("results")`),
 * une fois la page sûre et la requête stable (`resultsPrefetch.ts`).
 */

import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { musicSectionLabel, useDebouncedText, useMusicByMbid, useMusicPrefetch, useMusicSearch, usePluginMusicSearch } from "@tentacle-tv/api-client";
import { normalizeMbid } from "@tentacle-tv/shared/music";
import { useOctaveProvider } from "../mode/useOctaveProvider";
import { RESULTS_STABLE_MS, resultsToAnnounce } from "./resultsPrefetch";

function recordingsOf(tracks: readonly { mbids: { recording: string | null } }[] | undefined): Set<string> {
  const out = new Set<string>();
  for (const t of tracks ?? []) {
    const r = normalizeMbid(t.mbids.recording);
    if (r) out.add(r);
  }
  return out;
}

export function useOctaveSearch(query: string) {
  const { t, i18n } = useTranslation("music");
  const provider = useOctaveProvider();
  const library = useMusicSearch(query);
  const prefetch = useMusicPrefetch(provider);

  // Ce que la bibliothèque a, d'après ses résultats, puis d'après l'index entier (by-mbid).
  const fromResults = useMemo(() => recordingsOf(library.data?.tracks), [library.data]);
  const releases = useMemo(() => {
    const out = new Set<string>();
    for (const a of library.data?.albums ?? []) {
      const r = normalizeMbid(a.mbids.release);
      if (r) out.add(r);
    }
    return out;
  }, [library.data]);
  const firstPass = usePluginMusicSearch(provider, query, { libraryRecordings: fromResults, libraryReleases: releases });
  const toCheck = useMemo(() => [...recordingsOf(firstPass.tracks)], [firstPass.tracks]);
  const byMbid = useMusicByMbid(toCheck);
  const known = useMemo(() => {
    const out = new Set(fromResults);
    for (const m of byMbid.data?.matches ?? []) {
      const r = normalizeMbid(m.recording);
      if (r) out.add(r);
    }
    return out;
  }, [byMbid.data, fromResults]);
  const external = usePluginMusicSearch(provider, query, { libraryRecordings: known, libraryReleases: releases });

  // La recherche est immédiate ; l'ANTICIPATION attend une page sûre d'une requête stable (resultsPrefetch.ts).
  const stableQuery = useDebouncedText(query, RESULTS_STABLE_MS);
  const announced = useRef<string | null>(null);
  useEffect(() => {
    const ids = external.tracks.map((track) => track.external?.id).filter((id): id is string => !!id);
    const toAnnounce = resultsToAnnounce({ query, stableQuery, provisional: external.provisional, ids, announced: announced.current });
    if (!toAnnounce) return;
    announced.current = query.trim();
    prefetch(toAnnounce, "results");
  }, [external.tracks, external.provisional, prefetch, query, stableQuery]);

  return {
    library,
    external,
    externalLabel: provider ? musicSectionLabel(provider, i18n.language, t("search.externalDefault")) : null,
  };
}
