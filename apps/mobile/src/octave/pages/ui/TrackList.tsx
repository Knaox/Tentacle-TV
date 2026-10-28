/**
 * Octave mobile — une courte liste de titres DANS une page qui défile déjà
 * (accueil, recherche « Tout », artiste : quelques rangées, sans liste
 * virtualisée imbriquée). Toucher une rangée lit la liste depuis elle, avec son
 * contexte (`search:<requête>`, `album:<id>`…). Chaque rangée se balaie vers
 * la droite (« Lire ensuite », file), comme sur une playlist.
 */

import { memo, useCallback } from "react";
import { View } from "react-native";
import type { MusicTrack } from "@tentacle-tv/shared/music";
import { usePagesCurrentKey, usePagesPlayer } from "../env/pagesPlayer";
import { TrackRow } from "./TrackRow";
import { playFrom } from "../env/playFrom";

interface TrackListProps {
  tracks: readonly MusicTrack[];
  /** La file jouée, si elle dépasse ce qui est montré (titres phares repliés). */
  queue?: readonly MusicTrack[];
  contextId: string;
  gutter: number;
  numbered?: boolean;
  hide?: { album?: boolean; artist?: boolean };
}

export const TrackList = memo(function TrackList({ tracks, queue, contextId, gutter, numbered, hide }: TrackListProps) {
  const player = usePagesPlayer();
  const current = usePagesCurrentKey();
  const list = queue ?? tracks;
  const play = useCallback((index: number) => playFrom(player, list, index, contextId), [contextId, list, player]);
  return (
    <View>
      {tracks.map((track, i) => (
        <TrackRow key={track.key} track={track} index={i} list={list} contextId={contextId} playing={current === track.key} onPlay={play} gutter={gutter} numbered={numbered} hide={hide} />
      ))}
    </View>
  );
});
