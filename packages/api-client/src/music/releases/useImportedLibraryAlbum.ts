/**
 * Octave — l'album de la BIBLIOTHÈQUE d'une sortie importée qui vient d'y entrer (`importedLibraryState` →
 * `library`) : celui qu'un titre dit déjà, sinon demandé au cœur par la règle de rapprochement de la bibliothèque
 * (`POST /api/music/match`, la même que pour tout album d'ailleurs) — une seule requête, gardée. `null` tant
 * qu'on ne sait pas : la page reste celle de la sortie, lisible.
 */

import { useQuery } from "@tanstack/react-query";
import type { MusicAlbum } from "@tentacle-tv/shared/music";
import { musicApi } from "../musicApi";
import { libraryMatchRequest } from "../useMusicLibraryMatch";
import { importedLibraryState } from "./releaseModel";

export function useImportedLibraryAlbum(album: MusicAlbum | null | undefined): string | null {
  const state = importedLibraryState(album);
  const known = state.kind === "library" ? state.albumId : null;
  const lookup = state.kind === "library" && !known && !!album;
  const query = useQuery({
    queryKey: ["music", "imported-library", album?.key ?? ""],
    queryFn: async ({ signal }) => {
      const request = libraryMatchRequest([], [{ album: album!, tracks: album!.tracks ?? [] }]);
      if (!request) return null;
      const answer = await musicApi.match(request, signal);
      return answer.albums.find((a) => a.album.jellyfinId)?.album.jellyfinId ?? null;
    },
    enabled: lookup,
    staleTime: Number.POSITIVE_INFINITY,
    retry: 1,
  });
  return known ?? (lookup ? (query.data ?? null) : null);
}
