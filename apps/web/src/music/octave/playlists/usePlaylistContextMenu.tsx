/**
 * Octave — le clic droit (et l'appui long) sur une playlist (rail, cartes, tête de page) ouvre le MÊME menu que
 * « … », au point du pointeur. Une playlist dont le menu n'a rien à offrir garde le menu du système.
 */

import type { MusicPlaylist } from "@tentacle-tv/shared/music";
import { useCollectionContextMenu } from "../collections/CollectionMenuButton";
import { usePlaylistSubject } from "./PlaylistMenu";

export function usePlaylistContextMenu(playlist: MusicPlaylist) {
  const { handlers, menu } = useCollectionContextMenu(usePlaylistSubject(playlist));
  return { ...handlers, menu };
}
