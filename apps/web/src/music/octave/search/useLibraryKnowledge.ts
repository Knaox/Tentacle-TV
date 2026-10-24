/**
 * Octave — ce que la bibliothèque a DÉJÀ, pour retirer les doublons de la
 * section externe : les résultats locaux, plus les enregistrements retrouvés
 * ailleurs dans la bibliothèque par `by-mbid` (une question par lot nouveau).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { MusicSearchResponse } from "@tentacle-tv/shared/music";
import { libraryApi } from "../data/libraryApi";
import { knowledgeOf, recordingsToCheck, type ExternalSection, type LibraryKnowledge } from "@tentacle-tv/shared/octave";

export function useLibraryKnowledge(library: MusicSearchResponse | undefined, sections: readonly ExternalSection[]): LibraryKnowledge {
  const [found, setFound] = useState<ReadonlySet<string>>(() => new Set());
  const checked = useRef<Set<string>>(new Set());
  const base = useMemo(() => knowledgeOf(library), [library]);
  const missing = recordingsToCheck(sections, base, checked.current);
  const missingKey = missing.join(",");

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!missingKey) return;
    const batch = missingKey.split(",").filter((r) => !checked.current.has(r));
    if (batch.length === 0) return;
    for (const r of batch) checked.current.add(r);
    // Un lot parti n'est jamais abandonné : une page suivante ne doit pas effacer sa réponse.
    libraryApi
      .byMbid(batch)
      .then((res) => {
        if (!mounted.current || res.matches.length === 0) return;
        setFound((prev) => new Set([...prev, ...res.matches.map((m) => m.recording)]));
      })
      .catch(() => {
        for (const r of batch) checked.current.delete(r);
      });
  }, [missingKey]);

  return useMemo(() => knowledgeOf(library, found), [library, found]);
}
