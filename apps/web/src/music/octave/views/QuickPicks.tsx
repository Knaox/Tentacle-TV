/**
 * Octave — « Écoutés récemment » en tête de l'accueil : des tuiles à relancer
 * d'un clic (la série reprend à ce titre). Deux rangées PLEINES au plus — trois
 * colonnes quand la place le permet, jamais une tuile seule sur sa rangée. Le
 * titre en cours se reconnaît (barres en couleur de marque, et en mot).
 */

import { memo, useRef } from "react";
import { AudioLines, Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { MusicTrack } from "@tentacle-tv/shared/music";
import { Artwork } from "../components/Artwork";
import { useGridColumns } from "../components/cardGrid";
import { useCurrentKey, useOctavePlayer, usePlayerSelector } from "../player/OctavePlayerProvider";
import { usePrefetchHandlers } from "../player/usePrefetchHandlers";

/** Une tuile fait au moins 15 rem ; trois colonnes au plus, deux rangées. */
const TILE_MIN_PX = 240;
const TILE_GAP_PX = 8;
const MAX_COLUMNS = 3;
const ROWS = 2;
const GRID_CLASS = "grid gap-2 px-2";

/** Combien de tuiles montrer pour `columns` colonnes : des rangées pleines, deux au plus. */
export function quickPickCount(available: number, columns: number): number {
  if (columns <= 0) return 0;
  const shown = Math.min(available, columns * ROWS);
  return shown >= columns ? shown - (shown % columns) : shown;
}

function useTileColumns(ref: React.RefObject<HTMLDivElement | null>): number {
  return Math.min(MAX_COLUMNS, useGridColumns(ref, TILE_MIN_PX, TILE_GAP_PX));
}

const QuickPick = memo(function QuickPick({ tracks, index, current, playing }: { tracks: readonly MusicTrack[]; index: number; current: boolean; playing: boolean }) {
  const { t } = useTranslation("music");
  const player = useOctavePlayer();
  const track = tracks[index] as MusicTrack;
  const prefetch = usePrefetchHandlers(() => [track]);
  return (
    <button
      type="button"
      onClick={() => (current ? player.togglePlay() : player.playList(tracks, index, "home:recent"))}
      {...prefetch}
      aria-label={t("track.play", { title: track.title })}
      aria-current={current ? "true" : undefined}
      className="group flex h-16 min-w-0 cursor-pointer items-center gap-3 overflow-hidden rounded-lg border border-line-subtle bg-fill-subtle pr-3 text-left transition-colors duration-150 hover:bg-fill-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
    >
      <Artwork url={track.artworkUrl} label={track.album?.title ?? track.title} thumb square className="h-16 w-16" />
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm font-semibold leading-5 ${current ? "text-brand" : "text-content-primary"}`}>{track.title}</span>
        <span className="block truncate text-xs leading-5 text-content-tertiary">{track.artists.map((a) => a.name).join(", ")}</span>
      </span>
      {current && playing ? (
        <AudioLines className="h-4 w-4 shrink-0 text-brand" aria-hidden />
      ) : (
        <span className="octave-hover-reveal octave-brand-fill flex h-8 w-8 shrink-0 items-center justify-center rounded-full opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden>
          <Play className="ml-0.5 h-4 w-4" fill="currentColor" />
        </span>
      )}
    </button>
  );
});

export function QuickPicks({ tracks }: { tracks: readonly MusicTrack[] }) {
  const { t } = useTranslation("music");
  const ref = useRef<HTMLDivElement>(null);
  const columns = useTileColumns(ref);
  const currentKey = useCurrentKey();
  const wantsPlay = usePlayerSelector((s) => s.wantsPlay);
  const count = quickPickCount(tracks.length, columns);
  return (
    <section ref={ref} aria-label={t("home.recentlyPlayed")} className={GRID_CLASS} style={{ gridTemplateColumns: `repeat(${Math.max(columns, 1)}, minmax(0, 1fr))` }}>
      {tracks.slice(0, count).map((track, i) => (
        <QuickPick key={track.key} tracks={tracks} index={i} current={track.key === currentKey} playing={track.key === currentKey && wantsPlay} />
      ))}
    </section>
  );
}

/** Les mêmes tuiles en attente. */
export function QuickPicksSkeleton() {
  const ref = useRef<HTMLDivElement>(null);
  const columns = useTileColumns(ref);
  return (
    <div ref={ref} aria-hidden className={GRID_CLASS} style={{ gridTemplateColumns: `repeat(${Math.max(columns, 1)}, minmax(0, 1fr))` }}>
      {Array.from({ length: columns * ROWS }, (_, i) => (
        <div key={i} className="flex h-16 items-center gap-3 overflow-hidden rounded-lg border border-line-subtle bg-fill-subtle pr-3">
          <div className="h-16 w-16 bg-fill-soft" />
          <div className="flex flex-1 flex-col gap-2">
            <div className="h-3 w-2/3 rounded bg-fill-soft" />
            <div className="h-2.5 w-1/3 rounded bg-fill-subtle" />
          </div>
        </div>
      ))}
    </div>
  );
}
