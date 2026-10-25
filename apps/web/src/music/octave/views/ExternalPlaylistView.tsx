/**
 * Octave — une playlist HORS bibliothèque (celle d'une extension) : sa tête (pochette, nom, qui l'a composée, nombre
 * de titres et durée), Lecture et Aléatoire, puis ses titres. Lecture seule : elle n'est pas une playlist Jellyfin
 * (on ne la modifie pas) ; chaque titre s'aime ou s'ajoute à une playlist comme tout titre hors bibliothèque.
 */

import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { queueActions } from "@tentacle-tv/shared/octave";
import { CollectionHeader, useCountAndDuration } from "../components/CollectionHeader";
import { TrackList, rowsOf } from "../components/TrackList";
import { EmptyState, ErrorState, HeaderSkeleton, RowsSkeleton } from "../components/ViewStates";
import { useExternalPlaylist } from "../data/useExternalPlaylist";
import { useOctavePlayer } from "../player/OctavePlayerProvider";

export function ExternalPlaylistView() {
  const { t } = useTranslation("music");
  const { id = "" } = useParams();
  const player = useOctavePlayer();
  const playlist = useExternalPlaylist(id);
  const tracks = useMemo(() => playlist.data?.tracks ?? [], [playlist.data]);
  const rows = useMemo(() => rowsOf(tracks), [tracks]);
  const meta = useCountAndDuration(tracks.length, tracks.reduce((s, track) => s + (track.durationMs ?? 0), 0));
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

  return (
    <div className="pb-10">
      <CollectionHeader
        kicker={t("playlist.kicker")}
        title={data.title}
        artworkUrl={data.artworkUrl}
        meta={
          <>
            {data.owner && <span className="font-semibold text-content-primary">{data.owner}</span>}
            {data.owner && <span aria-hidden>·</span>}
            <span>{meta}</span>
          </>
        }
        canPlay={tracks.length > 0}
        onPress={() => tracks[0] && player.prefetch([tracks[0]], "press")}
        onPlay={() => player.playList(tracks, 0, contextId)}
        onShuffle={() => queueActions.playShuffled(player, tracks, contextId)}
      />
      <div className="px-2 md:px-6">
        {rows.length === 0 ? (
          <EmptyState>{t("library.empty")}</EmptyState>
        ) : (
          <TrackList rows={rows} contextId={contextId} showArtwork showAlbum label={data.title} showHeader />
        )}
      </div>
    </div>
  );
}
