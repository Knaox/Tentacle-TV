/**
 * Octave — un album ou un artiste, de la bibliothèque (identifiant Jellyfin)
 * ou hors bibliothèque (clé `ext:<pluginId>:<id>`, servi par l'extension qui
 * l'a donné, si elle déclare la route). Sans extension : la clé externe ne
 * mène nulle part (« introuvable »), sans erreur qui trahisse quoi que ce soit.
 */

import { useQuery } from "@tanstack/react-query";
import { useUserId } from "@tentacle-tv/api-client";
import { parseTrackKey, type MusicAlbum, type MusicArtist } from "@tentacle-tv/shared/music";
import { externalApi } from "../extension/externalApi";
import { useMusicProviders } from "../extension/musicProviders";
import { libraryApi } from "./libraryApi";
import { octaveKeys } from "./libraryQueries";

function useTarget(idOrKey: string) {
  const providers = useMusicProviders();
  const parsed = idOrKey.startsWith("ext:") ? parseTrackKey(idOrKey) : null;
  if (parsed?.kind === "external") {
    const provider = providers.find((p) => p.pluginId === parsed.ref.pluginId) ?? null;
    return { external: true as const, provider, externalId: parsed.ref.id };
  }
  return { external: false as const, provider: null, externalId: null };
}

export function useAlbumEntity(idOrKey: string) {
  const user = useUserId();
  const target = useTarget(idOrKey);
  return useQuery<MusicAlbum | null>({
    queryKey: octaveKeys.album(user, idOrKey),
    queryFn: async () => {
      if (!target.external) return libraryApi.album(idOrKey);
      const request = target.provider && target.externalId ? externalApi.album(target.provider, target.externalId) : null;
      return request ? request : null;
    },
    enabled: !!user && !!idOrKey,
    staleTime: 60_000,
  });
}

export function useArtistEntity(idOrKey: string) {
  const user = useUserId();
  const target = useTarget(idOrKey);
  return useQuery<MusicArtist | null>({
    queryKey: octaveKeys.artist(user, idOrKey),
    queryFn: async () => {
      if (!target.external) return libraryApi.artist(idOrKey);
      const request = target.provider && target.externalId ? externalApi.artist(target.provider, target.externalId) : null;
      return request ? request : null;
    },
    enabled: !!user && !!idOrKey,
    staleTime: 60_000,
  });
}
