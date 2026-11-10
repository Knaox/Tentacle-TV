import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  useSeasonBrowser,
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
import { CheckSquareIcon } from "@phosphor-icons/react/dist/csr/CheckSquare";
import { WatchedGlyph } from "./cards/cardGlyphs";
import { WatchedSelectionToolbar } from "./WatchedSelectionToolbar";
import { useMultiSelect } from "../hooks/useMultiSelect";
import { SeasonTabs, seasonTabId } from "./episodes/SeasonTabs";
import { SeasonDownloadAction } from "../downloads/SeasonDownloadAction";
import { DownloadDialog } from "../downloads/DownloadDialog";
import { EpisodeRow } from "./EpisodeRow";
import type { EpisodeRowRating } from "./EpisodeRow";
import { tmdbIdForItem } from "../lib/ratingIdentity";
import { useDownloadsVisibility } from "../downloads/useDownloadState";
import { RevealCell, RevealScope } from "./grid/RevealCell";
import { SeasonDeleteAction } from "./libraryDelete/SeasonDeleteAction";

/** Hauteur d'une ligne d'épisode (vignette de 176 px en 16:9, 10 px de marge), réservée avant son premier passage. */
const EPISODE_ROW_HEIGHT = 119;
/** Une action de saison : la pilule secondaire du socle ; sous le verre natif, un bouton de verre. */
const SEASON_ACTION = "btn btn-soft btn-sm lg-glass-btn";

interface EpisodeListProps {
  seriesId: string;
  /** Épisode en cours de consultation — surligné + scroll auto (fiche épisode). */
  currentEpisodeId?: string;
  /** Saison à présélectionner (saison de l'épisode courant). */
  initialSeasonId?: string;
  /**
   * Saison imposée à l'ouverture, avant toute autre : celle du dernier ajout
   * d'une carte regroupée des « Derniers ajouts ». Le marquage de l'épisode à
   * reprendre n'en dépend pas.
   */
  openSeasonId?: string;
  /** La SÉRIE (fiche série, ou parent d'une fiche épisode) : son tmdb note les épisodes. */
  seriesItem?: MediaItem | null;
  /**
   * Fiche d'une SÉRIE : la liste s'ouvre sur la saison de l'épisode à
   * reprendre, et l'attend plutôt que d'ouvrir une saison qui changerait.
   */
  followResume?: boolean;
}

export function EpisodeList({ seriesId, currentEpisodeId, initialSeasonId, openSeasonId, seriesItem, followResume = false }: EpisodeListProps) {
  const navigate = useNavigate();
  const { t } = useTranslation("common");
  const { t: tDownloads } = useTranslation("downloads");
  // Desktop + droit Jellyfin uniquement — sinon aucune action de
  // téléchargement n'est rendue (invisibilité stricte).
  const { canDownload } = useDownloadsVisibility();
  const [batchItems, setBatchItems] = useState<MediaItem[] | null>(null);
  const client = useJellyfinClient();
  // Le choix de la saison, la liste légère puis ses sources, les
  // préchargements : la même mécanique sur toutes les plateformes.
  const browser = useSeasonBrowser({
    seriesId,
    preferredSeasonId: openSeasonId ?? initialSeasonId,
    followResume,
    currentEpisodeSeasonId: currentEpisodeId ? initialSeasonId : undefined,
  });
  const { seasons, selectedSeasonId, episodes } = browser;
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
    <div className="row-gutter max-w-[1392px] py-3">
      {/* La bande des saisons — des pastilles NEUTRES, la saison affichée en
          pastille pleine (`theme/seasonTabs.css`), celle en cours marquée d'un
          point, préchargement au survol et au focus — puis les gestes de la
          saison affichée, au bout de la même ligne. */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1 basis-64">
          {browser.seasonsLoading ? (
            <div className="flex gap-2">{Array.from({ length: 4 }).map((_, i) => <Shimmer key={i} width="104px" height="40px" className="!rounded-full" />)}</div>
          ) : seasons && seasons.length > 0 ? (
            <SeasonTabs
              seasons={seasons}
              selectedId={selectedSeasonId}
              markedId={browser.markedSeasonId}
              onSelect={browser.select}
              onIntent={browser.prefetch}
            />
          ) : null}
        </div>

        {/* Season actions bar */}
        {!browser.episodesLoading && episodes?.length ? (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={handleSeasonToggle} disabled={isBusy} aria-pressed={allWatched} className={SEASON_ACTION}>
              <WatchedGlyph className="h-4 w-4" filled={allWatched} />
              {allWatched ? t("common:markSeasonUnwatched") : t("common:markSeasonWatched")}
            </button>
            {!ms.isSelecting && (
              <button type="button" onClick={ms.enterSelectionMode} className={SEASON_ACTION}>
                <CheckSquareIcon className="h-4 w-4" aria-hidden />
                {t("common:select")}
              </button>
            )}
            {/* Téléchargement de la saison (desktop, droit requis — sinon absent).
                Il lit les sources (tailles, pistes) : il paraît quand elles sont là. */}
            <SeasonDownloadAction episodes={browser.withSources ?? []} />
            {/* Supprimer la saison (droit Jellyfin requis — sinon absent), à l'écart, au bout. */}
            <SeasonDeleteAction seasonId={selectedSeasonId} seasonName={seasons?.find((s) => s.Id === selectedSeasonId)?.Name} />
          </div>
        ) : null}
      </div>

      {/* Episodes.
          Une saison d'anime dépasse couramment la centaine d'épisodes, et chaque
          ligne porte sa vignette (≈ 200 Ko décodés) plus ses propres abonnements
          au cache. Le contenu des lignes hors du champ est démonté, leur place
          est gardée (cf. `RevealCell`) : la mise en page ne bouge pas d'un pixel,
          et la sélection multiple survit puisqu'elle porte sur des identifiants. */}
      <RevealScope>
        <div
          // `-mx-2.5` : la marge intérieure d'une ligne ne décale pas son numéro du titre de la section.
          className="-mx-2.5 space-y-1"
          role="tabpanel"
          aria-labelledby={selectedSeasonId ? seasonTabId(selectedSeasonId) : undefined}
        >
          {browser.episodesLoading ? (
            Array.from({ length: 6 }).map((_, i) => <Shimmer key={i} height={`${EPISODE_ROW_HEIGHT}px`} className="!rounded-tile" />)
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
                  keyboard
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
                  // Les sources (tailles, pistes) sont exigées par le dialogue.
                  const selection = (browser.withSources ?? []).filter((ep) => ms.isSelected(ep.Id));
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
          mode="season"
          batchTitle={tDownloads("dialogTitleSelection", { count: batchItems.length })}
          onClose={() => setBatchItems(null)}
        />
      )}
    </div>
  );
}
