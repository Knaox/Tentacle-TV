/**
 * Octave — une playlist HORS bibliothèque (clé `ext:<pluginId>:<id>`), servie par l'extension qui l'a donnée si
 * elle déclare la vue (`music.playlist`) ; sans elle, la clé ne mène nulle part (« introuvable »), sans rien
 * trahir. La clé de cache est celle que la lecture d'un geste emploie (`search/useTopPlayback.ts`) : une playlist
 * lue depuis sa carte s'ouvre ensuite aussitôt.
 */

import { useQuery } from "@tanstack/react-query";
import { fetchExternalPlaylist } from "@tentacle-tv/api-client";
import { parseTrackKey, type ExternalMusicPlaylist } from "@tentacle-tv/shared/music";
import { isFromProvider, useOctaveProvider } from "../mode/useOctaveProvider";
import { externalViewKey } from "../search/useTopPlayback";

export function useExternalPlaylist(key: string) {
  const provider = useOctaveProvider();
  const parsed = key.startsWith("ext:") ? parseTrackKey(key) : null;
  const ref = parsed?.kind === "external" ? parsed.ref : null;
  const usable = ref !== null && isFromProvider(provider, ref.pluginId) && !!provider?.music.playlist;
  return useQuery<ExternalMusicPlaylist | null>({
    queryKey: externalViewKey("playlist", key),
    queryFn: ({ signal }) => (usable && ref && provider ? fetchExternalPlaylist(provider, ref.id, signal) : Promise.resolve(null)),
    enabled: ref !== null,
    staleTime: 60_000,
    retry: false,
  });
}
