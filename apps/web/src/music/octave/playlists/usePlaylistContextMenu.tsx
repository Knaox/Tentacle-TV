/**
 * Octave — le clic droit sur une playlist (rail, cartes, tête de page) ouvre le MÊME menu que « … », au point
 * du clic. Une playlist que le compte ne peut ni gérer ni quitter garde le menu du système.
 */

import { useCallback, useState, type MouseEvent } from "react";
import { usePlaylistSharingRules } from "@tentacle-tv/api-client";
import type { MusicPlaylist } from "@tentacle-tv/shared/music";
import { PlaylistMenuPanel } from "./PlaylistMenu";

export function usePlaylistContextMenu(playlist: MusicPlaylist) {
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  const { isMember } = usePlaylistSharingRules(playlist);
  const open = useCallback((e: MouseEvent) => {
    e.preventDefault();
    setPoint({ x: e.clientX, y: e.clientY });
  }, []);
  return {
    onContextMenu: playlist.editable || isMember ? open : undefined,
    menu: point ? <PlaylistMenuPanel playlist={playlist} anchor={point} onClose={() => setPoint(null)} /> : null,
  };
}
