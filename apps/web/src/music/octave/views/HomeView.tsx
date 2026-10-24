/**
 * Octave — l'accueil : salutation, écoutés récemment (raccourcis), ajoutés
 * récemment (albums), vos titres les plus écoutés, vos playlists.
 */

import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlbumCard, CardGrid, PlaylistCard, Shelf } from "../components/Cards";
import { Artwork } from "../components/Artwork";
import { TrackList, rowsOf } from "../components/TrackList";
import { CardsSkeleton, EmptyState, ErrorState, RowsSkeleton } from "../components/ViewStates";
import { useMusicHome } from "../data/libraryQueries";
import { octavePaths } from "../octavePaths";
import { useOctavePlayer } from "../player/OctavePlayerProvider";
import { usePrefetchHandlers } from "../player/usePrefetchHandlers";
import type { MusicTrack } from "@tentacle-tv/shared/music";

function greetingKey(hour: number): "home.morning" | "home.afternoon" | "home.evening" {
  return hour < 12 ? "home.morning" : hour < 18 ? "home.afternoon" : "home.evening";
}

/** Un raccourci « écouté récemment » : pochette et titre, un clic relance la série. */
function QuickPick({ tracks, index }: { tracks: readonly MusicTrack[]; index: number }) {
  const { t } = useTranslation("music");
  const player = useOctavePlayer();
  const track = tracks[index] as MusicTrack;
  const prefetch = usePrefetchHandlers(() => [track]);
  return (
    <button
      type="button"
      onClick={() => player.playList(tracks, index, "home:recent")}
      {...prefetch}
      aria-label={t("track.play", { title: track.title })}
      className="group flex min-w-0 cursor-pointer items-center gap-3 overflow-hidden rounded-md bg-fill-subtle pr-3 text-left transition-colors duration-150 hover:bg-fill-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
    >
      <Artwork url={track.artworkUrl} className="h-14 w-14 rounded-none" />
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-content-primary">{track.title}</span>
        <span className="block truncate text-xs text-content-tertiary">{track.artists.map((a) => a.name).join(", ")}</span>
      </span>
    </button>
  );
}

export function HomeView() {
  const { t } = useTranslation("music");
  const home = useMusicHome();
  const greeting = t(greetingKey(new Date().getHours()));
  const recent = home.data?.recentlyPlayed ?? [];
  const mostRows = useMemo(() => rowsOf((home.data?.mostPlayed ?? []).slice(0, 5)), [home.data]);

  if (home.isError) return <ErrorState onRetry={() => void home.refetch()} />;
  const empty = home.data && !recent.length && !home.data.recentlyAdded.length && !home.data.mostPlayed.length && !home.data.playlists.length;

  return (
    <div className="flex flex-col gap-10 px-2 pb-10 pt-6 md:px-6">
      <h1 className="px-2 text-3xl font-black tracking-tight text-content-primary">{greeting}</h1>
      {home.isPending && (
        <>
          <CardsSkeleton count={6} />
          <RowsSkeleton rows={5} />
        </>
      )}
      {empty && <EmptyState>{t("home.empty")}</EmptyState>}
      {recent.length > 0 && (
        <section aria-label={t("home.recentlyPlayed")} className="grid grid-cols-1 gap-2 px-2 sm:grid-cols-2 xl:grid-cols-3">
          {recent.slice(0, 6).map((track, i) => (
            <QuickPick key={track.key} tracks={recent} index={i} />
          ))}
        </section>
      )}
      {(home.data?.recentlyAdded.length ?? 0) > 0 && (
        <Shelf
          title={t("home.recentlyAdded")}
          action={
            <Link to={octavePaths.library} className="text-sm font-semibold text-content-tertiary hover:text-content-primary hover:underline">
              {t("common.seeAll")}
            </Link>
          }
        >
          <CardGrid>
            {home.data?.recentlyAdded.slice(0, 12).map((album) => <AlbumCard key={album.key} album={album} />)}
          </CardGrid>
        </Shelf>
      )}
      {mostRows.length > 0 && (
        <Shelf title={t("home.mostPlayed")}>
          <TrackList rows={mostRows} contextId="home:most" showArtwork showAlbum label={t("home.mostPlayed")} />
        </Shelf>
      )}
      {(home.data?.playlists.length ?? 0) > 0 && (
        <Shelf title={t("home.playlists")}>
          <CardGrid>
            {home.data?.playlists.slice(0, 12).map((p) => <PlaylistCard key={p.jellyfinId} playlist={p} />)}
          </CardGrid>
        </Shelf>
      )}
    </div>
  );
}
