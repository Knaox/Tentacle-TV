/**
 * Octave — l'AUTRE moitié d'un artiste (mission 3) : sur la page d'un artiste de la bibliothèque, ce que
 * l'extension connaît de lui ; sur celle d'un artiste d'ailleurs, ce que la bibliothèque a de lui.
 *
 * - Bibliothèque → ailleurs : la recherche de l'extension, liste « artistes » seule si elle la déclare (la MÊME
 *   requête, le même cache que la puce « Artistes » de la recherche), puis sa vue artiste (même clé de cache que
 *   `useArtistEntity`) — aucune route nouvelle du contrat ; une extension d'avant y répond comme à une recherche.
 * - Ailleurs → bibliothèque : la recherche de l'index local du cœur (< 100 ms), puis la vue de l'artiste Jellyfin.
 * - Rattachement : `pickArtist` (MBID, sinon nom). Rien ne part tant que `near` est faux (la section n'approche pas
 *   de l'écran) : jamais au survol, jamais pour une page qu'on ne fait que traverser.
 */

import { useQuery } from "@tanstack/react-query";
import { fetchExternalArtist, useMusicArtist, useMusicSearch, usePluginMusicSearch } from "@tentacle-tv/api-client";
import type { MusicArtist, MusicArtistResponse } from "@tentacle-tv/shared/music";
import { isFromProvider, useOctaveProvider } from "../../mode/useOctaveProvider";
import { pickArtist } from "./artistMatch";

export interface ArtistCounterpart {
  /** Page d'un artiste de la bibliothèque : le même chez l'extension (avec ses titres phares et ses parutions). */
  elsewhere: MusicArtist | null;
  /** Page d'un artiste d'ailleurs : le même dans la bibliothèque. */
  library: MusicArtistResponse | null;
  /** On cherche encore : la place de la section reste réservée. */
  pending: boolean;
}

const LIMIT = 10;

export function useArtistCounterpart(artist: MusicArtist | null | undefined, near: boolean): ArtistCounterpart {
  const provider = useOctaveProvider();
  const fromLibrary = !!artist?.jellyfinId;
  const name = artist?.name ?? "";

  // Bibliothèque → ailleurs.
  const wantsElsewhere = near && fromLibrary && provider !== null;
  const kind = provider?.music.searchKinds?.includes("artists") ? "artists" : undefined;
  const search = usePluginMusicSearch(wantsElsewhere ? provider : null, name, { limit: LIMIT, kind, enabled: wantsElsewhere });
  const candidates = [...(search.top?.kind === "artist" ? [search.top.artist] : []), ...search.artists].filter(
    (c) => c.jellyfinId === null && isFromProvider(provider, c.external?.pluginId),
  );
  const match = artist && wantsElsewhere ? pickArtist(artist, candidates) : null;
  const ref = match?.external ?? null;
  const elsewhere = useQuery({
    queryKey: ["music", "external", "artist", match?.key ?? null],
    queryFn: ({ signal }) => (provider && ref ? fetchExternalArtist(provider, ref.id, signal) : Promise.resolve(null)),
    enabled: ref !== null && provider !== null,
    staleTime: 60_000,
    retry: false,
  });
  // Toute la recherche lue sans rien de rattaché : il n'y a rien ailleurs.
  const searchDone = !search.pending && (search.complete || search.failed);
  const elsewherePending = wantsElsewhere && (match ? elsewhere.isPending && !elsewhere.isError : !searchDone);

  // Ailleurs → bibliothèque.
  const wantsLibrary = near && !!artist && !fromLibrary;
  const local = useMusicSearch(wantsLibrary ? name : "", { limit: LIMIT, debounceMs: 0, enabled: wantsLibrary });
  const own = artist && wantsLibrary ? pickArtist(artist, local.data?.artists ?? []) : null;
  const library = useMusicArtist(own?.jellyfinId ?? null);
  const libraryPending = wantsLibrary && (own ? library.isPending : local.pending || local.isPending);

  return {
    elsewhere: wantsElsewhere && match ? elsewhere.data ?? null : null,
    library: wantsLibrary && own ? library.data ?? null : null,
    pending: elsewherePending || libraryPending,
  };
}
