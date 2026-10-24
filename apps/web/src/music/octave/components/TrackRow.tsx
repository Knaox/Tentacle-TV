/**
 * Octave — une rangée de titre. Un clic lit (la barre se met à jour dans la
 * même image), le survol et l'appui ANTICIPENT (`hover`, `press`). Le titre en
 * cours est marqué en mot (lecteurs d'écran) et en couleur de marque.
 */

import { memo } from "react";
import { Play, Volume2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { MusicTrack } from "@tentacle-tv/shared/music";
import type { TrackActions } from "../actions/useTrackActions";
import { durationLabel } from "@tentacle-tv/shared/octave";
import { octavePaths } from "../octavePaths";
import { usePrefetchHandlers } from "../player/usePrefetchHandlers";
import { Artwork } from "./Artwork";
import { AvailabilityMark } from "./AvailabilityMark";
import { HeartButton } from "./HeartButton";
import { TrackMenu } from "./TrackMenu";

export interface TrackRowProps {
  track: MusicTrack;
  /** Numéro affiché (piste d'album ou rang dans la liste). */
  number: number;
  current: boolean;
  failed?: boolean;
  showArtwork?: boolean;
  showAlbum?: boolean;
  actions: TrackActions;
  /** Rang dans la liste : le rappel est STABLE (une rangée ne se redessine pas quand le titre courant change ailleurs). */
  index: number;
  onPlayIndex: (index: number) => void;
  entryId?: string | null;
  onRemoveEntry?: (entryId: string) => void;
}

function ArtistLinks({ track }: { track: MusicTrack }) {
  return (
    <>
      {track.artists.map((artist, i) => (
        <span key={`${artist.name}-${i}`}>
          {i > 0 && ", "}
          {artist.jellyfinId ? (
            <Link to={octavePaths.artist(artist.jellyfinId)} onClick={(e) => e.stopPropagation()} className="hover:text-content-primary hover:underline">
              {artist.name}
            </Link>
          ) : (
            artist.name
          )}
        </span>
      ))}
    </>
  );
}

export const TrackRow = memo(function TrackRow({ track, number, current, failed = false, showArtwork = false, showAlbum = false, actions, index, onPlayIndex, entryId = null, onRemoveEntry }: TrackRowProps) {
  const { t } = useTranslation("music");
  const onPlay = () => onPlayIndex(index);
  const onRemove = entryId && onRemoveEntry ? () => onRemoveEntry(entryId) : undefined;
  const prefetch = usePrefetchHandlers(() => [track]);
  const muted = track.availability === "pending" || failed;
  return (
    <div
      role="row"
      tabIndex={0}
      aria-current={current ? "true" : undefined}
      onClick={onPlay}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target === e.currentTarget) onPlay();
      }}
      {...prefetch}
      className={`octave-row group grid cursor-pointer select-none items-center gap-3 rounded-md px-2 py-1.5 transition-colors duration-150 hover:bg-fill-subtle focus-visible:bg-fill-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${
        showAlbum ? "grid-cols-[2rem_minmax(0,1fr)_minmax(0,0.8fr)_auto] md:grid-cols-[2rem_minmax(0,1.4fr)_minmax(0,1fr)_auto]" : "grid-cols-[2rem_minmax(0,1fr)_auto]"
      }`}
    >
      <div role="gridcell" className="relative flex h-8 w-8 items-center justify-center text-sm tabular-nums text-content-tertiary">
        {current ? (
          <Volume2 className="h-4 w-4 text-brand" aria-label={t("track.nowPlaying")} />
        ) : (
          <>
            <span className="octave-row-number transition-opacity duration-150">{number}</span>
            <span className="octave-row-play absolute inset-0 flex items-center justify-center text-content-primary transition-opacity duration-150" aria-hidden>
              <Play className="h-4 w-4" fill="currentColor" />
            </span>
          </>
        )}
      </div>
      <div role="gridcell" className="flex min-w-0 items-center gap-3">
        {showArtwork && <Artwork url={track.artworkUrl} className="h-10 w-10" />}
        <div className="min-w-0">
          <div className={`flex items-center gap-1.5 truncate text-[15px] font-medium ${current ? "text-brand" : muted ? "text-content-secondary" : "text-content-primary"}`}>
            <span className="truncate">{track.title}</span>
            {track.explicit && (
              <span className="shrink-0 rounded-sm bg-fill-medium px-1 text-[10px] font-bold leading-4 text-content-secondary" title={t("track.explicit")}>
                E<span className="sr-only">{t("track.explicit")}</span>
              </span>
            )}
          </div>
          <div className="flex min-w-0 items-center gap-1.5 text-[13px] text-content-tertiary">
            <AvailabilityMark availability={track.availability} failed={failed} />
            <span className="truncate">
              <ArtistLinks track={track} />
            </span>
          </div>
        </div>
      </div>
      {showAlbum && (
        <div role="gridcell" className="min-w-0 truncate text-[13px] text-content-tertiary">
          {track.album?.jellyfinId ? (
            <Link to={octavePaths.album(track.album.jellyfinId)} onClick={(e) => e.stopPropagation()} className="hover:text-content-primary hover:underline">
              {track.album.title}
            </Link>
          ) : (
            track.album?.title
          )}
        </div>
      )}
      <div role="gridcell" className="flex items-center gap-1">
        <HeartButton track={track} actions={actions} quiet />
        <span className="w-12 text-right text-[13px] tabular-nums text-content-tertiary">{durationLabel(track.durationMs)}</span>
        <TrackMenu track={track} actions={actions} onRemove={onRemove} />
      </div>
    </div>
  );
});
