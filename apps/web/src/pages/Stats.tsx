import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useViewingStats, viewingStatsFailure } from "@tentacle-tv/api-client";
import {
  listeningState, statsLocale, VIEWING_STATS_PERIODS, type ViewingStats, type ViewingStatsPeriod,
} from "@tentacle-tv/shared";
import { PageTransition } from "../components/PageTransition";
import { ActivityChart } from "../components/stats/ActivityChart";
import { PotentialTile } from "../components/stats/PotentialTile";
import { RecordsGrid } from "../components/stats/RecordsGrid";
import { RhythmHeatmap } from "../components/stats/RhythmHeatmap";
import { StatsAbout } from "../components/stats/StatsAbout";
import { DevicesCard, GenresCard, MixCard } from "../components/stats/StatsDistributions";
import { StatsHeader } from "../components/stats/StatsHeader";
import { ListeningCard, OriginsCard } from "../components/stats/StatsLanguages";
import { MoviesSection } from "../components/stats/StatsMovies";
import { StatsOverview } from "../components/stats/StatsOverview";
import { StatsPairs } from "../components/stats/StatsPairs";
import { StatsPersona } from "../components/stats/StatsPersona";
import { StatsSection } from "../components/stats/StatsSection";
import { StatsFailure, StatsNeverWatched, StatsPeriodEmpty, StatsSkeleton } from "../components/stats/StatsStates";
import { PeopleSection, SeriesRail } from "../components/stats/StatsTitleRails";
import { TasteSection } from "../components/stats/TasteSection";
import { useBackOrHome } from "../mirror/catalog/useBackOrHome";
import { useMirror } from "../mirror/useFormFactor";

/** Sous une minute, une période n'a rien à raconter : une lecture d'essai n'est pas une activité. */
const NOISE_SECONDS = 60;

const parsePeriod = (raw: string | null): ViewingStatsPeriod =>
  VIEWING_STATS_PERIODS.includes(raw as ViewingStatsPeriod) ? (raw as ViewingStatsPeriod) : "all";

/**
 * Vos statistiques — ce que vous avez regardé, quand, comment, et ce que vos
 * recommandations ont appris de vous.
 *
 * La période vit dans l'URL (`?period=30d|year`, « depuis le début » par
 * défaut) : un lien la garde, le retour aussi. Changer de période laisse la
 * page affichée, estompée, le temps de la réponse — le serveur a calculé les
 * trois d'un coup. L'en-tête ne prend plus l'image du titre le plus regardé :
 * la page garde les couleurs de l'app, quoi qu'on regarde.
 *
 * ⚠️ Hors du périmètre webOS : `lazyPagesTv.tsx` exporte `Stats` en écran
 * « indisponible ».
 */
export function Stats() {
  const { t, i18n } = useTranslation("stats");
  const mirror = useMirror();
  const back = useBackOrHome();
  const [params, setParams] = useSearchParams();
  const period = parsePeriod(params.get("period"));
  const setPeriod = useCallback(
    (next: ViewingStatsPeriod) => setParams(next === "all" ? {} : { period: next }, { replace: true }),
    [setParams]
  );
  const query = useViewingStats(period, statsLocale(i18n.language));
  const stats = query.data;
  // Jamais rien vu : l'état vide porte son propre titre (au téléphone, l'en-tête garde le retour).
  const neverWatched = stats !== undefined && !stats.hasHistory;

  let body;
  if (!stats) {
    body = query.isError
      ? <StatsFailure outdated={viewingStatsFailure(query.error) === "outdated"} onRetry={() => void query.refetch()} />
      : <StatsSkeleton label={t("loading")} />;
  } else if (neverWatched) {
    body = <StatsNeverWatched />;
  } else {
    body = <StatsBody stats={stats} period={period} onPeriodChange={setPeriod} pending={query.isPlaceholderData} />;
  }

  return (
    <PageTransition>
      <div className="min-h-screen pb-20">
        {(mirror || !neverWatched) && <StatsHeader title={t("title")} kicker={t("kicker")} onBack={mirror ? back : undefined} />}
        {/* Mêmes marges que l'en-tête : titre et contenu s'alignent. */}
        <div className="relative z-10 px-4 sm:px-8 md:px-14">{body}</div>
      </div>
    </PageTransition>
  );
}

interface StatsBodyProps {
  stats: ViewingStats;
  period: ViewingStatsPeriod;
  onPeriodChange: (period: ViewingStatsPeriod) => void;
  pending: boolean;
}

function StatsBody({ stats, period, onPeriodChange, pending }: StatsBodyProps) {
  const { t } = useTranslation("stats");
  const empty = stats.totals.seconds < NOISE_SECONDS && stats.totals.movies + stats.totals.episodes === 0;
  const hasDevices = stats.devices.length > 0;
  const { movieSeconds, seriesSeconds, animeSeconds } = stats.split;

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <StatsOverview stats={stats} period={period} onPeriodChange={onPeriodChange} pending={pending} counters={!empty} />
      {empty ? (
        <StatsPeriodEmpty onShowAll={() => onPeriodChange("all")} />
      ) : (
        <div className={`flex flex-col gap-4 transition-opacity duration-200 md:gap-5 ${pending ? "opacity-60" : "opacity-100"}`}>
          <StatsPersona stats={stats} />
          <StatsSection title={t("activityTitle")} hint={t(`activityHint_${stats.timeline.unit}`)}>
            <ActivityChart timeline={stats.timeline} />
          </StatsSection>
          <div className={`grid gap-4 md:gap-5 ${hasDevices ? "lg:grid-cols-3" : ""}`}>
            <StatsSection title={t("rhythmTitle")} className={hasDevices ? "lg:col-span-2" : ""}>
              <RhythmHeatmap grid={stats.rhythm.grid} />
            </StatsSection>
            {hasDevices && <DevicesCard stats={stats} />}
          </div>
          <StatsPairs
            cards={[
              [stats.genres.length > 0, <GenresCard key="genres" stats={stats} />],
              [movieSeconds + seriesSeconds + animeSeconds > 0 || stats.decades.length > 0, <MixCard key="mix" stats={stats} />],
              [stats.origins.countries.length > 0, <OriginsCard key="origins" stats={stats} />],
              [listeningState(stats.listening) !== "hidden", <ListeningCard key="listening" stats={stats} />],
            ]}
          />
          <MoviesSection stats={stats} />
          <SeriesRail stats={stats} />
          <PeopleSection stats={stats} />
          <RecordsGrid records={stats.records} />
        </div>
      )}
      <TasteSection taste={stats.taste} />
      <PotentialTile taste={stats.taste} />
      <StatsAbout stats={stats} />
    </div>
  );
}
