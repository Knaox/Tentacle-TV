/**
 * Octave — un album ou un artiste, de la bibliothèque (identifiant Jellyfin :
 * `useMusicAlbum` / `useMusicArtist`, A3) ou hors bibliothèque (clé
 * `ext:<pluginId>:<id>`, servi par l'extension qui l'a donné si elle déclare la
 * route : `fetchExternalAlbum` / `fetchExternalArtist`, A5). Sans extension :
 * la clé externe ne mène nulle part (« introuvable »), sans rien trahir.
 *
 * Un album hors bibliothèque ouvert depuis une carte s'affiche AUSSITÔT avec
 * ce que la carte montrait (`albumPreview.ts`, `isPlaceholder`), ses titres
 * à la réponse.
 */

import { useQuery } from "@tanstack/react-query";
import { fetchExternalAlbum, fetchExternalArtist, useMusicAlbum, useMusicArtist } from "@tentacle-tv/api-client";
import { parseTrackKey, type MusicAlbum, type MusicArtist } from "@tentacle-tv/shared/music";
import { isFromProvider, useOctaveProvider } from "../mode/useOctaveProvider";
import { albumPreview } from "./albumPreview";

interface EntityState<T> {
  data: T | null | undefined;
  isPending: boolean;
  isError: boolean;
  /** `data` est l'aperçu de la carte (sans titres), la réponse n'est pas encore là. */
  isPlaceholder: boolean;
  refetch: () => unknown;
}

function externalIdOf(idOrKey: string): { pluginId: string; id: string } | null {
  const parsed = idOrKey.startsWith("ext:") ? parseTrackKey(idOrKey) : null;
  return parsed?.kind === "external" ? { pluginId: parsed.ref.pluginId, id: parsed.ref.id } : null;
}

function useExternal<T>(kind: "album" | "artist", idOrKey: string, fetcher: typeof fetchExternalAlbum | typeof fetchExternalArtist): EntityState<T> | null {
  const provider = useOctaveProvider();
  const ref = externalIdOf(idOrKey);
  const usable = ref !== null && isFromProvider(provider, ref.pluginId);
  const query = useQuery({
    queryKey: ["music", "external", kind, idOrKey],
    queryFn: ({ signal }) => (usable && ref ? (fetcher(provider, ref.id, signal) as Promise<T | null>) : Promise.resolve(null)),
    enabled: ref !== null,
    staleTime: 60_000,
    retry: false,
  });
  if (ref === null) return null;
  // En attendant la réponse, l'album que la carte montrait (jamais à la place d'une réponse ni d'une erreur).
  const preview = kind === "album" && usable && query.isPending ? (albumPreview(idOrKey) as T | undefined) : undefined;
  if (preview) return { data: preview, isPending: false, isError: false, isPlaceholder: true, refetch: query.refetch };
  return { data: usable ? query.data : null, isPending: usable && query.isPending, isError: query.isError, isPlaceholder: false, refetch: query.refetch };
}

export function useAlbumEntity(idOrKey: string): EntityState<MusicAlbum> {
  const external = useExternal<MusicAlbum>("album", idOrKey, fetchExternalAlbum);
  const library = useMusicAlbum(external ? null : idOrKey);
  return external ?? { data: library.data, isPending: library.isPending, isError: library.isError, isPlaceholder: false, refetch: library.refetch };
}

export function useArtistEntity(idOrKey: string): EntityState<MusicArtist> {
  const external = useExternal<MusicArtist>("artist", idOrKey, fetchExternalArtist);
  const library = useMusicArtist(external ? null : idOrKey);
  return external ?? { data: library.data, isPending: library.isPending, isError: library.isError, isPlaceholder: false, refetch: library.refetch };
}
