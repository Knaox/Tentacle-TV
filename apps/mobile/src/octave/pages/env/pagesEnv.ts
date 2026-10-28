/**
 * Octave mobile — ce que les pages tiennent de l'APPLICATION : l'extension de
 * musique de ce serveur (Sillon, ou rien), le stockage de l'appareil (préchargé,
 * synchrone : `RNStorageAdapter`), le propriétaire de la mémoire (serveur +
 * compte, un profil de la Famille compris) et l'adresse affichable d'une
 * pochette (le jeton en `api_key` vers le serveur Tentacle seulement, la règle
 * du moteur `elementSourceUrl`, la même que le bureau).
 */

import { useCallback, useMemo } from "react";
import { useJellyfinClient, useMusicProvider, useTentacleConfig, type MusicProvider } from "@tentacle-tv/api-client";
import { elementSourceUrl, type OctaveDeviceStore } from "@tentacle-tv/shared/octave";
import type { MusicCapablePlugin } from "@tentacle-tv/shared/music";
import { useActivePlugins } from "@/hooks/useActivePlugins";
import { useServerUrl } from "@/providers/ServerUrlContext";
import { octaveOwnerOf } from "./owner";

export { octaveOwnerOf };

/** L'extension de musique de ce serveur pour ce compte, ou `null` (rien hors bibliothèque, nulle part). */
export function useOctavePagesProvider(): MusicProvider | null {
  const plugins = useActivePlugins().data;
  return useMusicProvider(plugins as readonly MusicCapablePlugin[] | undefined);
}

/** Le stockage synchrone de l'appareil, vu par les règles des pages. */
export function useDeviceStore(): OctaveDeviceStore {
  return useTentacleConfig().storage;
}

export function useOctaveOwner(): string | null {
  const store = useDeviceStore();
  const { serverUrl } = useServerUrl();
  const rawUser = store.getItem("tentacle_user");
  return useMemo(() => octaveOwnerOf(serverUrl, rawUser), [serverUrl, rawUser]);
}

export type ArtworkResolver = (url: string | null | undefined) => string | null;

/** L'adresse affichable d'une pochette (chemin du serveur → absolu + jeton ; autre hôte : telle quelle). */
export function useArtworkResolver(): ArtworkResolver {
  const { serverUrl } = useServerUrl();
  const client = useJellyfinClient();
  const token = client.getToken();
  return useCallback(
    (url) => {
      if (!url) return null;
      if (/^[a-z][a-z0-9+.-]*:\/\//i.test(url) && !/^https?:\/\//i.test(url)) return url;
      if (/^https?:\/\//i.test(url) || !serverUrl) return url;
      return elementSourceUrl(url, { baseUrl: serverUrl, token, useCredentials: false });
    },
    [serverUrl, token],
  );
}
