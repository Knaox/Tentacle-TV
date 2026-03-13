import { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSeasons, useEpisodes, useJellyfinClient, useWatchedToggle, useBatchWatchedToggle } from "@tentacle-tv/api-client";
import { Shimmer } from "@tentacle-tv/ui";
import type { MediaItem } from "@tentacle-tv/shared";
import { FadeImage } from "./FadeImage";
import { useMultiSelect } from "../hooks/useMultiSelect";

export function EpisodeList({ seriesId }: { seriesId: string }) {
  const navigate = useNavigate();
  const { t } = useTranslation("common");
  const client = useJellyfinClient();
  const { data: seasons, isLoading: seasonsLoading } = useSeasons(seriesId);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | undefined>();
  const { data: episodes, isLoading: episodesLoading } = useEpisodes(seriesId, selectedSeasonId);
  const ms = useMultiSelect();

  const batchCtx = useMemo(() => ({ seriesId, seasonId: selectedSeasonId }), [seriesId, selectedSeasonId]);
  const { markWatched: batchMarkWatched, markUnwatched: batchMarkUnwatched } = useBatchWatchedToggle(batchCtx);

  useEffect(() => {
    if (seasons?.length && !selectedSeasonId) setSelectedSeasonId(seasons[0].Id);
  }, [seasons, selectedSeasonId]);

  // Reset selection on season change
  useEffect(() => {
    ms.exitSelectionMode();
  }, [selectedSeasonId]); // eslint-disable-line react-hooks/exhaustive-deps

  const allWatched = useMemo(
    () => !!episodes?.length && episodes.every((ep) => ep.UserData?.Played),
    [episodes],
  );

  const episodeIds = useMemo(() => episodes?.map((ep) => ep.Id) ?? [], [episodes]);

  const handleSeasonToggle = useCallback(() => {
    if (allWatched) {
      batchMarkUnwatched.mutate(episodeIds);
    } else {
      batchMarkWatched.mutate(episodeIds);
    }
  }, [allWatched, episodeIds, batchMarkWatched, batchMarkUnwatched]);

  const handleBatchWatched = useCallback(() => {
    batchMarkWatched.mutate([...ms.selected]);
    ms.exitSelectionMode();
  }, [batchMarkWatched, ms]);

  const handleBatchUnwatched = useCallback(() => {
    batchMarkUnwatched.mutate([...ms.selected]);
    ms.exitSelectionMode();
  }, [batchMarkUnwatched, ms]);

  const isBusy = batchMarkWatched.isPending || batchMarkUnwatched.isPending;

  return (
    <div className="px-4 md:px-8 py-4">
      {/* Season tabs */}
      {seasonsLoading ? (
        <div className="flex gap-3">{Array.from({ length: 4 }).map((_, i) => <Shimmer key={i} width="100px" height="36px" />)}</div>
      ) : (
        <div className="mb-4 flex gap-2 overflow-x-auto scrollbar-hide">
          {seasons?.map((s) => (
            <button
              key={s.Id}
              onClick={() => setSelectedSeasonId(s.Id)}
              className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                selectedSeasonId === s.Id
                  ? "bg-tentacle-accent text-white"
                  : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
              }`}
            >
              {s.Name}
            </button>
          ))}
        </div>
      )}

      {/* Season actions bar */}
      {!episodesLoading && episodes?.length ? (
        <div className="mb-3 flex items-center gap-2">
          <button
            onClick={handleSeasonToggle}
            disabled={isBusy}
            className="rounded-lg bg-white/5 px-3 py-1.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40"
          >
            {allWatched ? t("common:markSeasonUnwatched") : t("common:markSeasonWatched")}
          </button>
          {!ms.isSelecting && (
            <button
              onClick={ms.enterSelectionMode}
              className="rounded-lg bg-white/5 px-3 py-1.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              {t("common:select")}
            </button>
          )}
        </div>
      ) : null}

      {/* Episodes */}
      <div className="space-y-3">
        {episodesLoading ? (
          Array.from({ length: 6 }).map((_, i) => <Shimmer key={i} height="100px" />)
        ) : (
          episodes?.map((ep) => (
            <EpisodeRow
              key={ep.Id}
              episode={ep}
              client={client}
              seriesId={seriesId}
              seasonId={selectedSeasonId}
              isSelecting={ms.isSelecting}
              isSelected={ms.isSelected(ep.Id)}
              onToggleSelect={() => ms.toggle(ep.Id)}
              onPlay={() => navigate(`/watch/${ep.Id}`)}
            />
          ))
        )}
      </div>

      {/* Selection toolbar */}
      {ms.isSelecting && (
        <WatchedSelectionToolbar
          count={ms.count}
          onSelectAll={() => ms.selectAll(episodeIds)}
          onCancel={ms.exitSelectionMode}
          onMarkWatched={handleBatchWatched}
          onMarkUnwatched={handleBatchUnwatched}
          isBusy={isBusy}
        />
      )}
    </div>
  );
}

interface EpisodeRowProps {
  episode: MediaItem;
  client: ReturnType<typeof useJellyfinClient>;
  seriesId: string;
  seasonId?: string;
  isSelecting: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  onPlay: () => void;
}

function EpisodeRow({ episode: ep, client, seriesId, seasonId, isSelecting, isSelected, onToggleSelect, onPlay }: EpisodeRowProps) {
  const { t } = useTranslation("common");
  const { markWatched, markUnwatched } = useWatchedToggle(ep.Id, { seriesId, seasonId });
  const thumbUrl = ep.ImageTags?.Primary
    ? client.getImageUrl(ep.Id, "Primary", { width: 300, quality: 85 })
    : ep.SeriesId ? client.getImageUrl(ep.SeriesId, "Backdrop", { width: 300, quality: 85 }) : "";

  const progress = ep.UserData?.PlayedPercentage;
  const played = ep.UserData?.Played;
  const runtime = ep.RunTimeTicks ? Math.floor(ep.RunTimeTicks / 600_000_000) : null;

  const handleClick = () => {
    if (isSelecting) {
      onToggleSelect();
    } else {
      onPlay();
    }
  };

  const handleWatchedToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (played) {
      markUnwatched.mutate();
    } else {
      markWatched.mutate();
    }
  };

  return (
    <div onClick={handleClick}
      className={`group flex cursor-pointer gap-4 rounded-xl p-3 transition-colors ${
        isSelecting && isSelected
          ? "bg-tentacle-accent/10 ring-1 ring-tentacle-accent/40"
          : "bg-white/[0.03] hover:bg-white/[0.07]"
      }`}>
      {/* Selection checkbox or thumbnail */}
      {isSelecting ? (
        <div className="flex w-28 flex-shrink-0 items-center justify-center sm:w-44">
          <div className={`h-5 w-5 rounded border-2 transition-colors ${
            isSelected ? "border-tentacle-accent bg-tentacle-accent" : "border-white/30"
          }`}>
            {isSelected && (
              <svg className="h-full w-full text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        </div>
      ) : (
        <div className="relative w-28 flex-shrink-0 overflow-hidden rounded-lg bg-tentacle-surface sm:w-44">
          <div className="aspect-video">
            {thumbUrl && <FadeImage src={thumbUrl} alt="" className="h-full w-full object-cover" loading="lazy" />}
          </div>
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90">
              <svg className="ml-0.5 h-5 w-5 text-tentacle-bg" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            </div>
          </div>
          {progress != null && progress > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
              <div className="h-full bg-tentacle-accent" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>
      )}

      {/* Info */}
      <div className="flex-1 py-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">
            {ep.IndexNumber}. {ep.Name}
          </span>
          {!isSelecting && (
            <button
              onClick={handleWatchedToggle}
              title={played ? t("common:markUnwatched") : t("common:markWatched")}
              className={`flex-shrink-0 transition-colors ${
                played ? "text-tentacle-accent hover:text-white/50" : "text-white/20 hover:text-tentacle-accent"
              }`}
            >
              {played ? (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </button>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-white/40">
          {runtime && <span>{t("common:minutesShort", { count: runtime })}</span>}
          {ep.PremiereDate && <span>{new Date(ep.PremiereDate).toLocaleDateString()}</span>}
        </div>
        {ep.Overview && <p className="mt-1.5 text-xs leading-relaxed text-white/50 line-clamp-2">{ep.Overview}</p>}
      </div>
    </div>
  );
}

interface WatchedSelectionToolbarProps {
  count: number;
  onSelectAll: () => void;
  onCancel: () => void;
  onMarkWatched: () => void;
  onMarkUnwatched: () => void;
  isBusy: boolean;
}

function WatchedSelectionToolbar({ count, onSelectAll, onCancel, onMarkWatched, onMarkUnwatched, isBusy }: WatchedSelectionToolbarProps) {
  const { t } = useTranslation("common");
  return createPortal(
    <div
      className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#12121a]/95 backdrop-blur-lg"
      style={{ animation: "slideUp 0.25s ease" }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-8">
        <span className="text-sm font-medium text-white/70">
          {t("common:selectedCount", { count })}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={onSelectAll}
            className="rounded-lg bg-white/5 px-3 py-1.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            {t("common:selectAll")}
          </button>
          <button
            onClick={onCancel}
            className="rounded-lg bg-white/5 px-3 py-1.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            {t("common:cancel")}
          </button>
          <button
            onClick={onMarkWatched}
            disabled={count === 0 || isBusy}
            className="rounded-lg bg-tentacle-accent/20 px-4 py-1.5 text-sm font-medium text-tentacle-accent ring-1 ring-tentacle-accent/30 transition-all hover:bg-tentacle-accent/30 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t("common:markWatched")}
          </button>
          <button
            onClick={onMarkUnwatched}
            disabled={count === 0 || isBusy}
            className="rounded-lg bg-white/5 px-4 py-1.5 text-sm font-medium text-white/70 ring-1 ring-white/10 transition-all hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t("common:markUnwatched")}
          </button>
        </div>
      </div>
      <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
    </div>,
    document.body,
  );
}
