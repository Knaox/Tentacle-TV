/**
 * Octave — les résultats d'une recherche VALIDÉE (Entrée, « Rechercher », une
 * suggestion choisie ; jamais à chaque lettre) : la BIBLIOTHÈQUE
 * (`useMusicSearch`, annulation, réponse précédente gardée), puis la section de
 * l'extension, progressive (`usePluginMusicSearch`, pages par curseur, fusion
 * par clé). La bibliothèque gagne : un enregistrement qu'elle a — dans ses
 * résultats, ou ailleurs (`useMusicByMbid`) — est retiré de la section.
 * Les premiers titres externes sont annoncés à l'extension (`prefetch("results")`)
 * dès sa page sûre : la requête est validée, elle n'a plus à se stabiliser.
 * Ce que la bibliothèque a SANS MBID (titre, artiste, durée : `POST /api/music/match`) est connu avant la
 * révélation aussi (`useOwnedLists`, la même demande que l'affichage) : rien ne bascule sous les yeux.
 *
 * Ce crochet dit aussi ce qui est PRÊT (`libraryReady`, `externalReady`) :
 * `useRevealedResults` attend tout pour tout montrer d'un coup. Web, bureau et
 * mobile : le MÊME crochet, l'extension passée par l'application.
 */

import { useEffect, useMemo, useRef } from "react";
import { externalReadiness, resultsToAnnounce } from "@tentacle-tv/shared/octave";
import { normalizeMbid } from "@tentacle-tv/shared/music";
import { musicSectionLabel, type MusicProvider } from "../../pluginMusic/musicProvider";
import { useMusicPrefetch } from "../../pluginMusic/useMusicActions";
import { useMusicSearch as usePluginMusicSearch } from "../../pluginMusic/useMusicSearch";
import { useMusicByMbid } from "../useMusicLibrary";
import { musicSearchText, useMusicSearch } from "../useMusicSearch";
import { useOwnedLists } from "./ownedSearch";

export interface OctaveSearchLabels {
  /** La langue de l'interface (nom de la section de l'extension). */
  language: string;
  /** Le nom de la section quand l'extension n'en donne pas (« Ailleurs »). */
  externalDefault: string;
}

function recordingsOf(tracks: readonly { mbids: { recording: string | null } }[] | undefined): Set<string> {
  const out = new Set<string>();
  for (const t of tracks ?? []) {
    const r = normalizeMbid(t.mbids.recording);
    if (r) out.add(r);
  }
  return out;
}

/** Une requête de TanStack a fini pour SA clé (ou n'a pas à partir) : ni attente, ni réponse d'avant affichée. */
export function settledQuery(q: { status: string; fetchStatus: string; isError: boolean; isFetching: boolean; isPlaceholderData: boolean }): boolean {
  if (q.isError) return true;
  if (q.status === "pending") return q.fetchStatus === "idle";
  return !q.isFetching && !q.isPlaceholderData;
}

export function useOctaveSearch(provider: MusicProvider | null, query: string, labels: OctaveSearchLabels) {
  // Validée : aucune attente de frappe.
  const library = useMusicSearch(query, { debounceMs: 0 });
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

  const announced = useRef<string | null>(null);
  useEffect(() => {
    const ids = external.tracks.map((track) => track.external?.id).filter((id): id is string => !!id);
    const toAnnounce = resultsToAnnounce({ query, stableQuery: query, provisional: external.provisional, ids, announced: announced.current });
    if (!toAnnounce) return;
    announced.current = query.trim();
    prefetch(toAnnounce, "results");
  }, [external.tracks, external.provisional, prefetch, query]);

  const libraryReady = library.settledQuery === musicSearchText(query) && settledQuery(library);
  // Ce que la bibliothèque possède parmi les titres externes est connu : sinon un titre quitterait la section après coup.
  const owned = useOwnedLists(external.provisional ? null : external);
  const ownedKnown = (toCheck.length === 0 || settledQuery(byMbid)) && owned.settled;
  const externalReady = externalReadiness({ available: external.available, complete: external.complete, provisional: external.provisional, pending: external.pending, settled: ownedKnown, failed: external.failed });

  return {
    library,
    libraryReady,
    external,
    externalReady,
    externalLabel: provider ? musicSectionLabel(provider, labels.language, labels.externalDefault) : null,
  };
}
