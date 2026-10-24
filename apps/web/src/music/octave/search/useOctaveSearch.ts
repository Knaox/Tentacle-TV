/**
 * Octave — la recherche : la BIBLIOTHÈQUE d'abord (`useMusicSearch`, A3 :
 * anti-rebond, annulation, réponse précédente gardée), puis la section de
 * l'extension, progressive (`usePluginMusicSearch`, A5 : pages par curseur,
 * fusion par clé). La bibliothèque gagne : un enregistrement qu'elle a — dans
 * ses résultats, ou ailleurs (`useMusicByMbid`, A3) — est retiré de la section.
 * Les premiers titres externes sont annoncés à l'extension (`prefetch("results")`).
 */

import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { musicSectionLabel, useMusicByMbid, useMusicPrefetch, useMusicSearch, usePluginMusicSearch } from "@tentacle-tv/api-client";
import { normalizeMbid } from "@tentacle-tv/shared/music";
import { useOctaveProvider } from "../mode/useOctaveProvider";

const RESULTS_PREFETCHED = 3;

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

  const announced = useRef<string>("");
  useEffect(() => {
    const ids = external.tracks.slice(0, RESULTS_PREFETCHED).map((track) => track.external?.id).filter((id): id is string => !!id);
    const signature = `${query}|${ids.join(",")}`;
    if (ids.length === 0 || announced.current === signature) return;
    announced.current = signature;
    prefetch(ids, "results");
  }, [external.tracks, prefetch, query]);

  return {
    library,
    external,
    externalLabel: provider ? musicSectionLabel(provider, i18n.language, t("search.externalDefault")) : null,
  };
}
