/**
 * Octave — la liste d'un FILTRE (Titres, Albums, Artistes, Playlists). Une extension qui la sert seule
 * (`music.searchKinds`) reçoit UNE requête, au choix de la puce (gardée ensuite par TanStack) ; sinon, rien ne
 * part : la page « Tout » déjà montrée est filtrée. Comme la page « Tout », la liste n'est montrée qu'avec ses
 * premières pochettes décodées (budget de `revealModel`), et ne bouge plus ensuite.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { usePluginMusicSearch } from "@tentacle-tv/api-client";
import type { MusicSearchKind } from "@tentacle-tv/shared/music";
import { preloadArtwork } from "../components/artworkPreload";
import { useArtworkResolver } from "../components/Artwork";
import { useOctaveProvider } from "../mode/useOctaveProvider";
import { ART_BUDGET_MS, ART_FIRST_CARDS, EXTERNAL_TRACKS_SHOWN } from "./revealModel";
import type { SearchFilter, ShownExternalLists } from "./searchLayout";

export interface KindResults {
  /** La liste de l'extension pour ce filtre, prête à montrer ; `null` : pas encore (ou rien ne viendra d'elle). */
  lists: ShownExternalLists | null;
  /** Une requête est partie et sa liste n'est pas encore montrable (place réservée). */
  pending: boolean;
}

/** `shown` : la page « Tout » déjà montrée (son extension), repli quand l'extension ne sert pas la liste seule. */
export function useKindResults(query: string, filter: SearchFilter, shown: ShownExternalLists | null): KindResults {
  const provider = useOctaveProvider();
  const kind: MusicSearchKind | null = filter === "all" ? null : filter;
  const served = !!kind && !!provider?.music.searchKinds?.includes(kind);
  const search = usePluginMusicSearch(provider, query, { kind: kind ?? undefined, enabled: served });
  const resolve = useArtworkResolver();
  const ready = served && !search.pending && (search.complete || search.failed);
  const lists = useMemo<ShownExternalLists | null>(
    () => (ready ? { top: null, tracks: search.tracks, albums: search.albums, artists: search.artists, playlists: search.playlists } : null),
    [ready, search.tracks, search.albums, search.artists, search.playlists],
  );
  const art = useMemo(
    () => (lists ? [...lists.tracks.slice(0, EXTERNAL_TRACKS_SHOWN).map((t) => t.artworkUrl), ...[...lists.albums, ...lists.artists, ...lists.playlists].slice(0, ART_FIRST_CARDS * 2).map((c) => ("imageUrl" in c ? c.imageUrl : c.artworkUrl))] : []),
    [lists],
  );
  const key = `${query}|${kind ?? "all"}`;
  const [decoded, setDecoded] = useState<string | null>(null);
  const started = useRef<string | null>(null);
  useEffect(() => {
    if (!lists || started.current === key) return;
    started.current = key;
    const srcs = art.map(resolve).filter((s): s is string => !!s);
    void preloadArtwork(srcs, ART_BUDGET_MS).then(() => setDecoded((d) => (started.current === key ? key : d)));
  }, [art, key, lists, resolve]);

  if (!kind) return { lists: null, pending: false };
  if (!served) return { lists: shown, pending: false };
  const showable = lists !== null && decoded === key;
  return { lists: showable ? lists : null, pending: !showable };
}
