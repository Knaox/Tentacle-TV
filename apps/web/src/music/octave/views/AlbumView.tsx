/**
 * Octave — un album : pochette, type, artistes, année, label, nombre de
 * titres, durée, qualité de la parution (la meilleure de ses pistes), puis
 * ses titres, disque par disque.
 */

import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { MusicAudioFormat, MusicTrack } from "@tentacle-tv/shared/music";
import { CollectionHeader, Dot, useCountAndDuration } from "../components/CollectionHeader";
import { TrackList, rowsOf } from "../components/TrackList";
import { ErrorState, HeaderSkeleton, RowsSkeleton } from "../components/ViewStates";
import { useAlbumEntity } from "../data/useEntityQueries";
import { octavePaths } from "../octavePaths";
import { queueActions } from "@tentacle-tv/shared/octave";
import { useOctavePlayer } from "../player/OctavePlayerProvider";
import { FormatBadge } from "../shell/FormatBadge";

/** La meilleure qualité de l'album (sans perte d'abord, puis profondeur et fréquence). */
export function bestFormat(tracks: readonly MusicTrack[]): MusicAudioFormat | null {
  let best: MusicAudioFormat | null = null;
  const score = (f: MusicAudioFormat) => (f.lossless ? 1e9 : 0) + (f.bitDepth ?? 0) * 1e6 + (f.sampleRate ?? 0) + (f.bitrate ?? 0) / 1e3;
  for (const t of tracks) if (t.format && (!best || score(t.format) > score(best))) best = t.format;
  return best;
}

/** Les titres dans l'ordre disque puis piste, et les disques présents. */
function inDiscOrder(tracks: readonly MusicTrack[]): { ordered: MusicTrack[]; discs: number[] } {
  const ordered = [...tracks].sort((a, b) => (a.discNumber ?? 1) - (b.discNumber ?? 1) || (a.trackNumber ?? 0) - (b.trackNumber ?? 0));
  return { ordered, discs: [...new Set(ordered.map((x) => x.discNumber ?? 1))] };
}

export function AlbumView() {
  const { t } = useTranslation("music");
  const { id = "" } = useParams();
  const player = useOctavePlayer();
  const album = useAlbumEntity(id);
  const { ordered: tracks, discs } = useMemo(() => inDiscOrder(album.data?.tracks ?? []), [album.data]);
  const rows = useMemo(() => rowsOf(tracks), [tracks]);
  const meta = useCountAndDuration(album.data?.trackCount ?? tracks.length, album.data?.durationMs ?? tracks.reduce((s, x) => s + (x.durationMs ?? 0), 0));
  const format = useMemo(() => bestFormat(tracks), [tracks]);
  const contextId = `album:${id}`;

  if (album.isPending) {
    return (
      <>
        <HeaderSkeleton />
        <RowsSkeleton />
      </>
    );
  }
  if (album.isError || !album.data) return <ErrorState onRetry={() => void album.refetch()} message={t("album.notFound")} />;
  const data = album.data;

  return (
    <div className="pb-10">
      <CollectionHeader
        kicker={t(`album.kind.${data.kind}`)}
        title={data.title}
        artworkUrl={data.artworkUrl}
        meta={
          <>
            {data.artists.map((artist, i) => {
              const target = artist.jellyfinId;
              return (
                <span key={`${artist.name}-${i}`} className="font-semibold text-content-primary">
                  {i > 0 && ", "}
                  {target ? (
                    <Link to={octavePaths.artist(target)} className="hover:underline">
                      {artist.name}
                    </Link>
                  ) : (
                    artist.name
                  )}
                </span>
              );
            })}
            {(data.releaseDate ?? data.year) && (
              <>
                <Dot />
                <span>{data.year ?? data.releaseDate?.slice(0, 4)}</span>
              </>
            )}
            <Dot />
            <span>{meta}</span>
            {data.label && (
              <>
                <Dot />
                <span>{data.label}</span>
              </>
            )}
            {format && <FormatBadge format={format} />}
          </>
        }
        canPlay={tracks.length > 0}
        onPress={() => tracks[0] && player.prefetch([tracks[0]], "press")}
        onPlay={() => player.playList(tracks, 0, contextId)}
        onShuffle={() => queueActions.playShuffled(player, tracks, contextId)}
      />
      <div className="px-2 md:px-6">
        <TrackList
          rows={rows}
          contextId={contextId}
          useTrackNumbers
          showHeader
          label={data.title}
          sectionBefore={discs.length > 1 ? (row, index) => (index === 0 || rows[index - 1]?.track.discNumber !== row.track.discNumber ? t("album.disc", { number: row.track.discNumber ?? 1 }) : null) : undefined}
        />
      </div>
    </div>
  );
}
