/**
 * Octave — ce que l'interface montre de la musique gardée (`keepRules.ts`),
 * lu une fois pour toute la vue : coquille, capacité `offline.music`, session
 * (compte de l'appareil, jamais un profil), droit `keepOffline` du compte, et
 * pour un titre d'ailleurs les droits de l'extension (route `rights` de son
 * contrat — absente : rien hors bibliothèque, comme avant).
 */

import { useQuery } from "@tanstack/react-query";
import { musicRouteUrl, tentacleApiFetch, useServerCapability } from "@tentacle-tv/api-client";
import { readMusicRights } from "@tentacle-tv/shared/music";
import { useActiveProfile } from "../../../auth/profileSession";
import { supportsMusicOffline } from "../../../desktop/capabilities";
import { useAccountKeepRight } from "../../../offline/offlineOwner";
import { useConnectivity } from "../../../offline/useConnectivity";
import { useOctaveProvider } from "../mode/useOctaveProvider";
import { canKeepTrack, musicOfflineSurface, type MusicOfflineSurface } from "./keepRules";
import { useKeptMusic } from "./useKeptMusic";

export function useMusicOfflineSurface(): MusicOfflineSurface {
  const native = supportsMusicOffline();
  const capability = useServerCapability("offline.music");
  const profileSession = useActiveProfile() !== null;
  const keepRight = useAccountKeepRight(profileSession);
  const kept = useKeptMusic();
  const provider = useOctaveProvider();
  const { state } = useConnectivity();
  const online = state === "online" || state === "checking";
  const rightsPath = provider?.music.offline && provider.music.rights ? provider.music.rights : null;
  const rights = useQuery({
    queryKey: ["music-rights", provider?.pluginId ?? null],
    queryFn: async () => readMusicRights(await tentacleApiFetch<unknown>(musicRouteUrl(provider!, rightsPath!))),
    enabled: native && capability && online && !profileSession && rightsPath !== null,
    staleTime: 60_000,
  });
  return musicOfflineSurface({
    native,
    capability,
    profileSession,
    keepRight,
    hasContent: kept.tracks.length > 0,
    providerId: rightsPath !== null && provider ? provider.pluginId : null,
    providerKeep: rights.data ? rights.data.keepOffline : null,
  });
}

export { canKeepTrack };
