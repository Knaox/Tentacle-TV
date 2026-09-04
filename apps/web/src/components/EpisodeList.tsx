import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  useSeasons,
  useEpisodes,
  useJellyfinClient,
  useBatchWatchedToggle,
  useDeleteRating,
  useRateItem,
  useMyEpisodeRatings,
  useTmdbSeasonEpisodes,
  episodeRatingIdentity,
} from "@tentacle-tv/api-client";
import { Shimmer } from "@tentacle-tv/ui";
import type { MediaItem } from "@tentacle-tv/shared";
import { WatchedSelectionToolbar } from "./WatchedSelectionToolbar";
import { useMultiSelect } from "../hooks/useMultiSelect";
import { HorizontalScrollRow } from "./HorizontalScrollRow";
import { SeasonDownloadAction } from "../downloads/SeasonDownloadAction";
import { DownloadDialog } from "../downloads/DownloadDialog";
import { EpisodeRow } from "./EpisodeRow";
import type { EpisodeRowRating } from "./EpisodeRow";
import { tmdbIdForItem } from "../lib/ratingIdentity";
import { useDownloadsVisibility } from "../downloads/useDownloadState";
import { RevealCell, RevealScope } from "./grid/RevealCell";

/** Hauteur d'une ligne d'épisode, réservée avant son premier passage. */
const EPISODE_ROW_HEIGHT = 100;

interface EpisodeListProps {
  seriesId: string;
  /** Épisode en cours de consultation — surligné + scroll auto (fiche épisode). */
  currentEpisodeId?: string;
  /** Saison à présélectionner (saison de l'épisode courant). */
  initialSeasonId?: string;
  /** La SÉRIE (fiche série, ou parent d'une fiche épisode) : son tmdb note les épisodes. */
  seriesItem?: MediaItem | null;
}

export function EpisodeList({ seriesId, currentEpisodeId, initialSeasonId, seriesItem }: EpisodeListProps) {
  const navigate = useNavigate();
  const { t } = useTranslation("common");
  const { t: tDownloads } = useTranslation("downloads");
  // Desktop + droit Jellyfin uniquement — sinon aucune action de
  // téléchargement n'est rendue (invisibilité stricte).
  const { canDownload } = useDownloadsVisibility();
  const [batchItems, setBatchItems] = useState<MediaItem[] | null>(null);
  const client = useJellyfinClient();
  const { data: seasons, isLoading: seasonsLoading } = useSeasons(seriesId);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | undefined>();
  const { data: episodes, isLoading: episodesLoading } = useEpisodes(seriesId, selectedSeasonId);
  const ms = useMultiSelect();

  // Notes d'épisodes : le tmdb de la SÉRIE, la saison sélectionnée, les notes
  // TMDB de la saison et celles du compte — UN abonnement pour toute la liste,
  // les lignes reçoivent des valeurs (jamais un abonnement par ligne).
  const seriesTmdbId = tmdbIdForItem(seriesItem);
  const seasonNumber = useMemo(
    () => seasons?.find((s) => s.Id === selectedSeasonId)?.IndexNumber ?? null,
    [seasons, selectedSeasonId],
  );
  const { data: tmdbEpisodes } = useTmdbSeasonEpisodes(seriesTmdbId, seasonNumber);
  const myEpisodeRatings = useMyEpisodeRatings(seriesTmdbId, seasonNumber);
  const { mutate: rateEpisode } = useRateItem();
  const { mutate: clearRating } = useDeleteRating();
  const ratingFor = useCallback(
    (ep: MediaItem): EpisodeRowRating | undefined => {
      const sn = ep.ParentIndexNumber ?? seasonNumber;
      if (!seriesTmdbId || sn == null || ep.IndexNumber == null) return undefined;
      const identity = episodeRatingIdentity(seriesTmdbId, sn, ep.IndexNumber);
      return {
        community: tmdbEpisodes?.get(ep.IndexNumber)?.voteAverage ?? ep.CommunityRating ?? null,
        mine: myEpisodeRatings.get(ep.IndexNumber) ?? null,
        onRate: (score) => rateEpisode({ ...identity, score, jellyfinItemId: ep.Id }),
        onClear: () => clearRating(identity),
      };
    },
    [seriesTmdbId, seasonNumber, tmdbEpisodes, myEpisodeRatings, rateEpisode, clearRating],
  );

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

      {/* Episodes.
          Une saison d'anime dépasse couramment la centaine d'épisodes, et chaque
          ligne porte sa vignette (≈ 200 Ko décodés) plus ses propres abonnements
          au cache. Le contenu des lignes hors du champ est démonté, leur place
          est gardée (cf. `RevealCell`) : la mise en page ne bouge pas d'un pixel,
          et la sélection multiple survit puisqu'elle porte sur des identifiants. */}
      <RevealScope>
        <div className="space-y-3">
          {episodesLoading ? (
            Array.from({ length: 6 }).map((_, i) => <Shimmer key={i} height="100px" />)
          ) : (
            episodes?.map((ep, i) => (
              <RevealCell key={ep.Id} minHeight={EPISODE_ROW_HEIGHT} eager={i < 8}>
                <EpisodeRow
                  episode={ep}
                  client={client}
                  seriesId={seriesId}
                  seasonId={selectedSeasonId}
                  isSelecting={ms.isSelecting}
                  isSelected={ms.isSelected(ep.Id)}
                  isCurrent={ep.Id === currentEpisodeId}
                  onToggleSelect={() => ms.toggle(ep.Id)}
                  onPlay={() => navigate(`/watch/${ep.Id}`)}
                  rating={ratingFor(ep)}
                />
              </RevealCell>
            ))
          )}
        </div>
      </RevealScope>

      {/* Selection toolbar */}
      {ms.isSelecting && (
        <WatchedSelectionToolbar
          count={ms.count}
          onSelectAll={() => ms.selectAll(episodeIds)}
          onCancel={ms.exitSelectionMode}
          onMarkWatched={handleBatchWatched}
          onMarkUnwatched={handleBatchUnwatched}
          isBusy={isBusy}
          onDownload={
            canDownload
              ? () => {
                  const selection = (episodes ?? []).filter((ep) => ms.isSelected(ep.Id));
                  if (selection.length === 0) return;
                  setBatchItems(selection);
                  ms.exitSelectionMode();
                }
              : undefined
          }
          downloadLabel={canDownload ? tDownloads("downloadSelection") : undefined}
        />
      )}

      {/* Téléchargement groupé de la sélection d'épisodes */}
      {batchItems && (
        <DownloadDialog
          items={batchItems}
          seasonMode
          batchTitle={tDownloads("dialogTitleSelection", { count: batchItems.length })}
          onClose={() => setBatchItems(null)}
        />
      )}
    </div>
  );
}
