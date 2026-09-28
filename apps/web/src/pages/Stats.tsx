import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BarChart3 } from "lucide-react";
import { useViewingStats, viewingStatsFailure } from "@tentacle-tv/api-client";
import { statsLocale, VIEWING_STATS_PERIODS, type ViewingStats, type ViewingStatsPeriod } from "@tentacle-tv/shared";
import { PageTransition } from "../components/PageTransition";
import { CollectionHero } from "../components/collection/CollectionHero";
import { ActivityChart } from "../components/stats/ActivityChart";
import { RecordsGrid } from "../components/stats/RecordsGrid";
import { RhythmHeatmap } from "../components/stats/RhythmHeatmap";
import { StatsAbout } from "../components/stats/StatsAbout";
import { DevicesCard, GenresCard, MixCard } from "../components/stats/StatsDistributions";
import { StatsHeroFigure } from "../components/stats/StatsHeroFigure";
import { StatsKpis } from "../components/stats/StatsKpis";
import { StatsPersona } from "../components/stats/StatsPersona";
import { StatsSection } from "../components/stats/StatsSection";
import { StatsFailure, StatsNeverWatched, StatsPeriodEmpty, StatsSkeleton } from "../components/stats/StatsStates";
import { MoviesRail, PeopleSection, SeriesRail } from "../components/stats/StatsTitleRails";
import { TasteSection } from "../components/stats/TasteSection";
import { useFeaturedTitle } from "../components/stats/useFeaturedTitle";
import { useBackOrHome } from "../mirror/catalog/useBackOrHome";
import { CollectionHero as MirrorCollectionHero } from "../mirror/screens/collection/CollectionHero";
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
 * trois d'un coup. Au téléphone (miroir), la même page, sous la bannière à
 * retour de l'app ; au bureau, sous la bannière des collections.
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
  const featured = useFeaturedTitle(stats);

  // Jamais rien vu : l'état vide porte son propre titre (au téléphone, la bannière garde le retour).
  const neverWatched = stats !== undefined && !stats.hasHistory;
  const hero = mirror ? (
    <MirrorCollectionHero items={featured} title={t("title")} kicker={t("kicker")} Icon={BarChart3} onBack={back} />
  ) : featured ? (
    // La bannière remonte sous la barre de navigation, comme Mes favoris.
    <div className="-mt-[56px] md:-mt-[68px]">
      <CollectionHero title={t("title")} kicker={t("kicker")} items={featured} />
    </div>
  ) : neverWatched ? null : (
    <header className="px-4 pb-2 pt-8 sm:px-8 md:px-14">
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-content-tertiary">{t("kicker")}</p>
      <h1 className="mt-2 text-display-3 text-content-primary">{t("title")}</h1>
    </header>
  );
  const overlap = !mirror && featured ? "-mt-10 md:-mt-14" : "pt-4";

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
        {hero}
        {/* Mêmes marges que le texte de la bannière : titre et contenu s'alignent. */}
        <div className={`relative z-10 px-4 sm:px-8 md:px-14 ${overlap}`}>{body}</div>
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

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <StatsHeroFigure stats={stats} period={period} onPeriodChange={onPeriodChange} pending={pending} />
      {empty ? (
        <StatsPeriodEmpty onShowAll={() => onPeriodChange("all")} />
      ) : (
        <div className={`flex flex-col gap-4 transition-opacity duration-200 md:gap-5 ${pending ? "opacity-60" : "opacity-100"}`}>
          <StatsKpis totals={stats.totals} />
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
          <div className="grid gap-4 md:gap-5 lg:grid-cols-2 lg:items-start">
            <GenresCard stats={stats} />
            <MixCard stats={stats} />
          </div>
          <SeriesRail stats={stats} />
          <MoviesRail stats={stats} />
          <PeopleSection stats={stats} />
          <RecordsGrid records={stats.records} />
        </div>
      )}
      <TasteSection taste={stats.taste} />
      <StatsAbout stats={stats} />
    </div>
  );
}
