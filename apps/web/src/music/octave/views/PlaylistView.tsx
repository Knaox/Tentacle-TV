/**
 * Octave — une playlist Jellyfin : ses entrées, et à leur place les ajouts
 * hors bibliothèque « en attente » (entrées `pending:<id>`), lisibles tout de
 * suite. Une playlist modifiable permet de retirer une entrée.
 */

import { useMemo } from "react";
import { ListMusic, Search } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMusicPlaylist, useRemoveMusicPlaylistEntry } from "@tentacle-tv/api-client";
import { CollectionHeader, useCountAndDuration } from "../components/CollectionHeader";
import { TrackList } from "../components/TrackList";
import { EMPTY_ACTION_CLASS, EmptyState, ErrorState, HeaderSkeleton, RowsSkeleton } from "../components/ViewStates";
import { octavePaths } from "../octavePaths";
import { mergePlaylist, queueActions } from "@tentacle-tv/shared/octave";
import { usePendingMusic } from "../pending/usePendingMusic";
import { useOctavePlayer } from "../player/OctavePlayerProvider";

export function PlaylistView() {
  const { t } = useTranslation("music");
  const { id = "" } = useParams();
  const { mutate: removeEntry } = useRemoveMusicPlaylistEntry();
  const player = useOctavePlayer();
  const playlist = useMusicPlaylist(id);
  const pending = usePendingMusic();
  const rows = useMemo(() => mergePlaylist(playlist.data?.entries ?? [], pending, id), [id, pending, playlist.data]);
  const tracks = useMemo(() => rows.map((r) => r.track), [rows]);
  const meta = useCountAndDuration(rows.length, rows.reduce((s, r) => s + (r.track.durationMs ?? 0), 0));
  const contextId = `playlist:${id}`;

  if (playlist.isPending) {
    return (
      <>
        <HeaderSkeleton />
        <RowsSkeleton />
      </>
    );
  }
  if (playlist.isError || !playlist.data) return <ErrorState onRetry={() => void playlist.refetch()} message={t("playlist.notFound")} />;

  const data = playlist.data;
  const remove = data.editable
    ? (entryId: string) => {
        removeEntry({ playlistId: id, entryId });
      }
    : undefined;

  return (
    <div className="pb-10">
      <CollectionHeader
        kicker={t("playlist.kicker")}
        title={data.name}
        artworkUrl={data.artworkUrl}
        meta={<span>{meta}</span>}
        canPlay={tracks.length > 0}
        onPress={() => tracks[0] && player.prefetch([tracks[0]], "press")}
        onPlay={() => player.playList(tracks, 0, contextId)}
        onShuffle={() => queueActions.playShuffled(player, tracks, contextId)}
      />
      <div className="px-2 md:px-6">
        {rows.length === 0 ? (
          <EmptyState
            icon={ListMusic}
            title={t("playlist.empty")}
            action={
              <Link to={octavePaths.search} className={EMPTY_ACTION_CLASS}>
                <Search className="h-4 w-4" aria-hidden />
                {t("views.findMusic")}
              </Link>
            }
          >
            {data.editable ? t("views.playlistEmptyHint") : null}
          </EmptyState>
        ) : (
          <TrackList rows={rows} contextId={contextId} showArtwork showAlbum showHeader label={data.name} onRemoveEntry={remove} />
        )}
      </div>
    </div>
  );
}
