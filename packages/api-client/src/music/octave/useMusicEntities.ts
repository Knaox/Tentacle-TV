/**
 * Octave — un album ou un artiste, de la bibliothèque (identifiant Jellyfin :
 * `useMusicAlbum` / `useMusicArtist`) ou hors bibliothèque (clé
 * `ext:<pluginId>:<id>`, servi par l'extension qui l'a donné si elle déclare la
 * route : `fetchExternalAlbum` / `fetchExternalArtist`). Sans extension : la
 * clé externe ne mène nulle part (« introuvable »), sans rien trahir.
 *
 * Un album hors bibliothèque ouvert depuis une carte s'affiche AUSSITÔT avec
 * ce que la carte montrait (`preview`, fourni par l'application), ses titres
 * à la réponse. Clé de cache `["music", "external", kind, idOrKey]` : celle de
 * l'intention (survol, appui) qui la demande d'avance.
 */

import { useQuery } from "@tanstack/react-query";
import { parseTrackKey, type MusicAlbum, type MusicArtist } from "@tentacle-tv/shared/music";
import type { MusicProvider } from "../../pluginMusic/musicProvider";
import { fetchExternalAlbum, fetchExternalArtist } from "../../pluginMusic/musicRequests";
import { useMusicAlbum, useMusicArtist } from "../useMusicLibrary";

export interface MusicEntityState<T> {
  data: T | null | undefined;
  isPending: boolean;
  isError: boolean;
  /** `data` est l'aperçu de la carte (sans titres), la réponse n'est pas encore là. */
  isPlaceholder: boolean;
  refetch: () => unknown;
}

/** La clé de cache d'une page hors bibliothèque (vue ET demande d'avance). */
export const externalEntityKey = (kind: "album" | "artist", idOrKey: string) => ["music", "external", kind, idOrKey] as const;

export function externalEntityRef(idOrKey: string | null | undefined): { pluginId: string; id: string } | null {
  const parsed = idOrKey?.startsWith("ext:") ? parseTrackKey(idOrKey) : null;
  return parsed?.kind === "external" ? { pluginId: parsed.ref.pluginId, id: parsed.ref.id } : null;
}

/** Ce titre (album, artiste) vient-il de CETTE extension (et donc ses gestes sont-ils possibles) ? */
export function isFromMusicProvider(provider: MusicProvider | null, pluginId: string | null | undefined): provider is MusicProvider {
  return provider !== null && !!pluginId && provider.pluginId === pluginId;
}

function useExternal<T>(
  provider: MusicProvider | null,
  kind: "album" | "artist",
  idOrKey: string,
  fetcher: typeof fetchExternalAlbum | typeof fetchExternalArtist,
  preview?: (key: string) => T | undefined,
): MusicEntityState<T> | null {
  const ref = externalEntityRef(idOrKey);
  const usable = ref !== null && isFromMusicProvider(provider, ref.pluginId);
  const query = useQuery({
    queryKey: externalEntityKey(kind, idOrKey),
    queryFn: ({ signal }) => (usable && ref ? (fetcher(provider, ref.id, signal) as Promise<T | null>) : Promise.resolve(null)),
    enabled: ref !== null,
    staleTime: 60_000,
    retry: false,
  });
  if (ref === null) return null;
  // En attendant la réponse, l'album que la carte montrait (jamais à la place d'une réponse ni d'une erreur).
  const shown = usable && query.isPending && preview ? preview(idOrKey) : undefined;
  if (shown) return { data: shown, isPending: false, isError: false, isPlaceholder: true, refetch: query.refetch };
  return { data: usable ? query.data : null, isPending: usable && query.isPending, isError: query.isError, isPlaceholder: false, refetch: query.refetch };
}

export function useMusicAlbumEntity(provider: MusicProvider | null, idOrKey: string, preview?: (key: string) => MusicAlbum | undefined): MusicEntityState<MusicAlbum> {
  const external = useExternal<MusicAlbum>(provider, "album", idOrKey, fetchExternalAlbum, preview);
  const library = useMusicAlbum(external ? null : idOrKey);
  return external ?? { data: library.data, isPending: library.isPending, isError: library.isError, isPlaceholder: false, refetch: library.refetch };
}

export function useMusicArtistEntity(provider: MusicProvider | null, idOrKey: string): MusicEntityState<MusicArtist> {
  const external = useExternal<MusicArtist>(provider, "artist", idOrKey, fetchExternalArtist);
  const library = useMusicArtist(external ? null : idOrKey);
  return external ?? { data: library.data, isPending: library.isPending, isError: library.isError, isPlaceholder: false, refetch: library.refetch };
}
