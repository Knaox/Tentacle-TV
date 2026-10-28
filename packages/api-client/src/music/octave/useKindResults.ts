/**
 * Octave — la liste d'un FILTRE (Titres, Albums, Artistes, Playlists). Une extension qui la sert seule
 * (`music.searchKinds`) reçoit UNE requête, au choix de la puce (gardée ensuite par TanStack) ; sinon, rien ne
 * part : la page « Tout » déjà montrée est filtrée. Comme la page « Tout », la liste n'est montrée qu'avec ses
 * premières pochettes décodées (budget de `revealModel`, port `ArtworkPreloader`), et ne bouge plus ensuite.
 */

import { useMemo } from "react";
import { ART_FIRST_CARDS, EXTERNAL_TRACKS_SHOWN, type SearchFilter, type ShownExternalLists } from "@tentacle-tv/shared/octave";
import type { MusicSearchKind } from "@tentacle-tv/shared/music";
import type { MusicProvider } from "../../pluginMusic/musicProvider";
import { useMusicSearch as usePluginMusicSearch } from "../../pluginMusic/useMusicSearch";
import type { ArtworkPreloader } from "./artworkPort";
import { useArtReady } from "./useRevealedResults";

export interface KindResults {
  /** La liste de l'extension pour ce filtre, prête à montrer ; `null` : pas encore (ou rien ne viendra d'elle). */
  lists: ShownExternalLists | null;
  /** Une requête est partie et sa liste n'est pas encore montrable (place réservée). */
  pending: boolean;
}

/** `shown` : la page « Tout » déjà montrée (son extension), repli quand l'extension ne sert pas la liste seule. */
export function useKindResults(
  provider: MusicProvider | null,
  query: string,
  filter: SearchFilter,
  shown: ShownExternalLists | null,
  preload: ArtworkPreloader,
): KindResults {
  const kind: MusicSearchKind | null = filter === "all" ? null : filter;
  const served = !!kind && !!provider?.music.searchKinds?.includes(kind);
  const search = usePluginMusicSearch(provider, query, { kind: kind ?? undefined, enabled: served });
  const ready = served && !search.pending && (search.complete || search.failed);
  const lists = useMemo<ShownExternalLists | null>(
    () => (ready ? { top: null, tracks: search.tracks, albums: search.albums, artists: search.artists, playlists: search.playlists } : null),
    [ready, search.tracks, search.albums, search.artists, search.playlists],
  );
  const art = useMemo(
    () => (lists ? [...lists.tracks.slice(0, EXTERNAL_TRACKS_SHOWN).map((t) => t.artworkUrl), ...[...lists.albums, ...lists.artists, ...lists.playlists].slice(0, ART_FIRST_CARDS * 2).map((c) => ("imageUrl" in c ? c.imageUrl : c.artworkUrl))] : []),
    [lists],
  );
  const decoded = useArtReady(`${query}|${kind ?? "all"}`, lists !== null, art, preload);
  if (!kind) return { lists: null, pending: false };
  if (!served) return { lists: shown, pending: false };
  const showable = lists !== null && decoded;
  return { lists: showable ? lists : null, pending: !showable };
}
