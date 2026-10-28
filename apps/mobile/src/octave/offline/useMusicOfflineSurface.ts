/**
 * Octave (mobile) — ce que l'interface montre de la musique gardée, la MÊME
 * porte que le bureau (`musicOfflineSurface`, `@tentacle-tv/offline-core/music`),
 * lue une fois pour tout le mode : le moteur du mobile sait garder la musique,
 * le serveur déclare `offline.music`, la session est celle du COMPTE DE
 * L'APPAREIL (jamais un profil), son droit `keepOffline` ; pour un titre
 * d'ailleurs, les droits de l'extension (route `rights` de son contrat —
 * absente : rien hors bibliothèque).
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchMusicRights, musicRightsKey, useServerCapability, type MusicProvider } from "@tentacle-tv/api-client";
import { musicOfflineSurface, type MusicOfflineSurface } from "@tentacle-tv/offline-core/music";
import { useConnectivity } from "../../offline/useConnectivity";
import { useAccountKeepRight, useOfflineProfileSession } from "../../offline/rights/useOfflineOwner";
import { useKeptMusic } from "./useKeptMusic";

export function useMusicOfflineSurface(provider: MusicProvider | null): MusicOfflineSurface {
  const capability = useServerCapability("offline.music");
  const profileSession = useOfflineProfileSession();
  const keepRight = useAccountKeepRight();
  const kept = useKeptMusic();
  const { state } = useConnectivity();
  const online = state === "online" || state === "checking";
  const rightsPath = provider?.music.offline && provider.music.rights ? provider.music.rights : null;
  const rights = useQuery({
    queryKey: musicRightsKey(provider?.pluginId ?? null),
    queryFn: ({ signal }) => fetchMusicRights(provider!, signal),
    enabled: capability && online && !profileSession && rightsPath !== null,
    staleTime: 60_000,
  });
  const hasContent = kept.tracks.length > 0;
  const providerId = rightsPath !== null && provider ? provider.pluginId : null;
  const providerKeep = rights.data ? rights.data.keepOffline : null;
  // Figée sur ce qu'elle dit : les rangées qui la lisent ne se redessinent pas à chaque rendu de la portée.
  return useMemo(
    () => musicOfflineSurface({ native: true, capability, profileSession, keepRight, hasContent, providerId, providerKeep }),
    [capability, profileSession, keepRight, hasContent, providerId, providerKeep],
  );
}
