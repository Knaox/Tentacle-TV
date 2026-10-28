/**
 * Octave mobile — aller d'une page à l'autre : les adresses d'Octave
 * (`octavePaths`, les mêmes que le bureau, reprises par expo-router), poussées
 * sur la pile de la coquille. Une carte sans page où aller (`entityTarget` nul)
 * ne mène nulle part.
 */

import { useMemo } from "react";
import { useRouter } from "expo-router";
import { entityTarget, octavePaths } from "@tentacle-tv/shared/octave/mode";
import type { MusicAlbum, MusicArtist } from "@tentacle-tv/shared/music";

export interface OctaveNav {
  album: (album: Pick<MusicAlbum, "jellyfinId" | "external" | "key">) => void;
  albumTarget: (target: string) => void;
  artist: (artist: Pick<MusicArtist, "jellyfinId" | "external" | "key">) => void;
  artistTarget: (target: string) => void;
  mood: (moodId: string) => void;
  playlist: (jellyfinId: string) => void;
  externalPlaylist: (key: string) => void;
  liked: () => void;
  search: (query?: string) => void;
  /** « Sur cet appareil » : la musique gardée, lisible sans réseau. */
  device: () => void;
}

export function useOctaveNav(): OctaveNav {
  const router = useRouter();
  return useMemo(() => {
    const go = (path: string) => router.push(path as never);
    return {
      album: (a) => {
        const target = entityTarget(a);
        if (target) go(octavePaths.album(target));
      },
      albumTarget: (target) => go(octavePaths.album(target)),
      artist: (a) => {
        const target = entityTarget(a);
        if (target) go(octavePaths.artist(target));
      },
      artistTarget: (target) => go(octavePaths.artist(target)),
      mood: (id) => go(octavePaths.mood(id)),
      playlist: (id) => go(octavePaths.playlist(id)),
      externalPlaylist: (key) => go(octavePaths.externalPlaylist(key)),
      liked: () => go(octavePaths.liked),
      search: (query) => go(query ? `${octavePaths.search}?q=${encodeURIComponent(query)}` : octavePaths.search),
      device: () => go(octavePaths.device),
    };
  }, [router]);
}
