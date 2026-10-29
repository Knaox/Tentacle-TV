/**
 * Octave — une playlist HORS bibliothèque (celle d'une extension) : sa tête (pochette, nom, qui l'a composée, nombre
 * de titres et durée), Lecture et Aléatoire, puis ses titres. Lecture seule : elle n'est pas une playlist Jellyfin
 * (on ne la modifie pas) ; chaque titre s'aime ou s'ajoute à une playlist comme tout titre hors bibliothèque. Un titre
 * que la bibliothèque a y est montré et joué comme le sien, marqué (`useOwnedTracks`).
 */

import { useMemo } from "react";
import { ListMusic } from "lucide-react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { queueActions } from "@tentacle-tv/shared/octave";
import { CollectionHeader, Dot, useCountAndDuration } from "../components/CollectionHeader";
import { KeepCollectionButton } from "../offline/KeepCollectionButton";
import { ShelfHeartButton } from "../collections/ShelfHeartButton";
import { KeptSizeMeta } from "../offline/KeptSizeMeta";
import { TrackList, rowsOf } from "../components/TrackList";
import { EmptyState, ErrorState, HeaderSkeleton, RowsSkeleton } from "../components/ViewStates";
import { useExternalPlaylist } from "../data/useExternalPlaylist";
import { useOwnedTracks } from "../library/useOwnedTracks";
import { useOctavePlayer } from "../player/OctavePlayerProvider";

export function ExternalPlaylistView() {
  const { t } = useTranslation("music");
  const { id = "" } = useParams();
  const player = useOctavePlayer();
  const playlist = useExternalPlaylist(id);
  const shown = useMemo(() => playlist.data?.tracks ?? [], [playlist.data]);
  const { tracks } = useOwnedTracks(shown);
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
            {data.owner && <Dot />}
            <span>{meta}</span>
            <KeptSizeMeta kind="playlist" collectionKey={id} tracks={tracks} />
          </>
        }
        canPlay={tracks.length > 0}
        onPress={() => tracks[0] && player.prefetch([tracks[0]], "press")}
        onPlay={() => player.playList(tracks, 0, contextId)}
        onShuffle={() => queueActions.playShuffled(player, tracks, contextId)}
        extra={
          <>
            <ShelfHeartButton subject={{ section: "playlists", item: { kind: "external", playlist: data } }} />
            <KeepCollectionButton kind="playlist" collectionKey={id} title={data.title} subtitle={data.owner ?? null} tracks={tracks} />
          </>
        }
      />
      <div className="px-2 md:px-6">
        {rows.length === 0 ? (
          <EmptyState icon={ListMusic} title={t("playlist.empty")} />
        ) : (
          <TrackList rows={rows} contextId={contextId} showArtwork showAlbum markLibrary label={data.title} showHeader />
        )}
      </div>
    </div>
  );
}
