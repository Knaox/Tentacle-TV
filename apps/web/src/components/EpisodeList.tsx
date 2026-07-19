import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSeasons, useEpisodes, useJellyfinClient, useWatchedToggle, useBatchWatchedToggle } from "@tentacle-tv/api-client";
import { Shimmer } from "@tentacle-tv/ui";
import type { MediaItem } from "@tentacle-tv/shared";
import { FadeImage } from "./FadeImage";
import { QualityChips, LanguagePill } from "./media/MetaChips";
import { extractMediaQuality } from "../lib/mediaQuality";
import { WatchedSelectionToolbar } from "./WatchedSelectionToolbar";
import { useMultiSelect } from "../hooks/useMultiSelect";
import { HorizontalScrollRow } from "./HorizontalScrollRow";
import { RichOverview } from "../lib/overviewHtml";
import { SeasonDownloadAction } from "../downloads/SeasonDownloadAction";

interface EpisodeListProps {
  seriesId: string;
  /** Épisode en cours de consultation — surligné + scroll auto (fiche épisode). */
  currentEpisodeId?: string;
  /** Saison à présélectionner (saison de l'épisode courant). */
  initialSeasonId?: string;
}

export function EpisodeList({ seriesId, currentEpisodeId, initialSeasonId }: EpisodeListProps) {
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
    if (!seasons?.length || selectedSeasonId) return;
    const preferred =
      initialSeasonId && seasons.some((s) => s.Id === initialSeasonId)
        ? initialSeasonId
        : seasons[0].Id;
    setSelectedSeasonId(preferred);
  }, [seasons, selectedSeasonId, initialSeasonId]);

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
        <HorizontalScrollRow className="gap-2" wrapperClassName="mb-4" ariaLabel={t("common:seasons", "Saisons")}>
          {seasons?.map((s) => (
            <button
              key={s.Id}
              onClick={() => setSelectedSeasonId(s.Id)}
              className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                selectedSeasonId === s.Id
                  ? "bg-[var(--brand-soft)] border border-[var(--brand)]/45 text-[var(--brand-light)]"
                  : "bg-fill-subtle text-content-tertiary hover:bg-fill-soft hover:text-content-primary"
              }`}
            >
              {s.Name}
            </button>
          ))}
        </HorizontalScrollRow>
      )}

      {/* Season actions bar */}
      {!episodesLoading && episodes?.length ? (
        <div className="mb-3 flex items-center gap-2">
          <button
            onClick={handleSeasonToggle}
            disabled={isBusy}
            className="rounded-lg bg-fill-subtle px-3 py-1.5 text-sm font-medium text-content-secondary transition-colors hover:bg-fill-soft hover:text-content-primary disabled:opacity-40"
          >
            {allWatched ? t("common:markSeasonUnwatched") : t("common:markSeasonWatched")}
          </button>
          {!ms.isSelecting && (
            <button
              onClick={ms.enterSelectionMode}
              className="rounded-lg bg-fill-subtle px-3 py-1.5 text-sm font-medium text-content-secondary transition-colors hover:bg-fill-soft hover:text-content-primary"
            >
              {t("common:select")}
            </button>
          )}
          {/* Téléchargement de la saison (desktop, droit requis — sinon absent). */}
          <SeasonDownloadAction episodes={episodes ?? []} />
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
              isCurrent={ep.Id === currentEpisodeId}
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
  isCurrent?: boolean;
  onToggleSelect: () => void;
  onPlay: () => void;
}

function EpisodeRow({ episode: ep, client, seriesId, seasonId, isSelecting, isSelected, isCurrent, onToggleSelect, onPlay }: EpisodeRowProps) {
  const { t } = useTranslation("common");
  const rowRef = useRef<HTMLDivElement>(null);
  const { markWatched, markUnwatched } = useWatchedToggle(ep.Id, { seriesId, seasonId });
  const quality = useMemo(() => extractMediaQuality(ep), [ep]);

  // Épisode courant : on le ramène au centre du viewport au montage.
  useEffect(() => {
    if (!isCurrent || !rowRef.current) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    rowRef.current.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
  }, [isCurrent]);
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
    <div ref={rowRef} onClick={handleClick}
      className={`group flex cursor-pointer gap-4 rounded-xl p-3 transition-colors ${
        isSelecting && isSelected
          ? "bg-tentacle-accent/10 ring-1 ring-tentacle-accent/40"
          : "bg-fill-faint hover:bg-fill-soft"
      }`}>
      {/* Selection checkbox or thumbnail */}
      {isSelecting ? (
        <div className="flex w-24 flex-shrink-0 xs:w-28 items-center justify-center sm:w-44">
          <div className={`h-5 w-5 rounded border-2 transition-colors ${
            isSelected ? "border-[var(--brand)]/45 bg-[var(--brand-soft)]" : "border-line-strong"
          }`}>
            {isSelected && (
              <svg className="h-full w-full text-[var(--brand-light)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        </div>
      ) : (
        <div className="relative w-24 flex-shrink-0 xs:w-28 overflow-hidden rounded-lg bg-tentacle-surface sm:w-44">
          <div className="aspect-video">
            {thumbUrl && <FadeImage src={thumbUrl} alt="" className="h-full w-full object-cover" loading="lazy" />}
          </div>
          {/* Halo + bouton lecture + barre de progression posés SUR la vignette :
              restent blanc/noir dans les deux thèmes (cf. règle « posé sur média »). */}
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
          <span className={`text-sm text-content-primary ${isCurrent ? "font-bold" : "font-semibold"}`}>
            {isCurrent && (
              <span
                className="mr-2 inline-block h-2 w-2 rounded-full bg-[var(--brand)] align-middle shadow-[0_0_8px_rgba(var(--brand-rgb),0.7)]"
                aria-hidden
              />
            )}
            {ep.IndexNumber}. {ep.Name}
          </span>
          {isCurrent && (
            <span className="flex-shrink-0 text-[10px] font-bold uppercase tracking-wider text-[var(--brand-light)]">
              {t("common:currentEpisode")}
            </span>
          )}
          {!isSelecting && (
            <button
              onClick={handleWatchedToggle}
              title={played ? t("common:markUnwatched") : t("common:markWatched")}
              className={`flex-shrink-0 transition-colors ${
                played ? "text-tentacle-accent hover:text-content-tertiary" : "text-content-disabled hover:text-tentacle-accent"
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
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-content-quaternary">
          {runtime && <span>{t("common:minutesShort", { count: runtime })}</span>}
          {ep.PremiereDate && <span>{new Date(ep.PremiereDate).toLocaleDateString()}</span>}
          {/* Méta qualité + langues à côté du titre (plus sur la miniature). */}
          <QualityChips quality={quality} density="full" />
          <LanguagePill labels={quality.audioLabels} max={3} />
        </div>
        {ep.Overview && <p className="mt-1.5 text-xs leading-relaxed text-content-tertiary line-clamp-2"><RichOverview text={ep.Overview} /></p>}
      </div>
    </div>
  );
}

