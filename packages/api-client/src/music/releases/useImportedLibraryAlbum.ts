/**
 * Octave — l'album de la BIBLIOTHÈQUE d'une sortie importée qui vient d'y entrer (`importedLibraryState` →
 * `library`) : celui qu'un titre dit déjà, sinon demandé au cœur par la règle de rapprochement de la bibliothèque
 * (`POST /api/music/match`, la même que pour tout album d'ailleurs) — une seule requête, gardée. `null` tant
 * qu'on ne sait pas : la page reste celle de la sortie, lisible.
 */

import { useQuery } from "@tanstack/react-query";
import type { MusicAlbum } from "@tentacle-tv/shared/music";
import { musicApi } from "../musicApi";
import { albumMatchQuery } from "../useMusicLibraryMatch";
import { importedLibraryState } from "./releaseModel";

/**
 * La demande au cœur : l'album SANS sa liste de titres (ils ont tous leur `jellyfinId` : la règle commune
 * `libraryMatchRequest` les écarterait et la couverture serait nulle) — titre, artistes, nombre de titres.
 */
export async function findImportedLibraryAlbum(album: MusicAlbum, signal?: AbortSignal): Promise<string | null> {
  const answer = await musicApi.match({ tracks: [], albums: [albumMatchQuery(album)] }, signal);
  return answer.albums.find((a) => a.ref === album.key && a.album.jellyfinId)?.album.jellyfinId ?? null;
}

export function useImportedLibraryAlbum(album: MusicAlbum | null | undefined): string | null {
  const state = importedLibraryState(album);
  const known = state.kind === "library" ? state.albumId : null;
  const lookup = state.kind === "library" && !known && !!album;
  const query = useQuery({
    queryKey: ["music", "imported-library", album?.key ?? ""],
    queryFn: ({ signal }) => findImportedLibraryAlbum(album!, signal),
    enabled: lookup,
    staleTime: Number.POSITIVE_INFINITY,
    retry: 1,
  });
  return known ?? (lookup ? (query.data ?? null) : null);
}
