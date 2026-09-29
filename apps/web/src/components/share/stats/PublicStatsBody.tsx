import { memo, useMemo } from "react";
import { BarChart3, CalendarSearch } from "lucide-react";
import {
  BADGES_MIN_SECONDS, habitsInsight, listeningState, viewingStatsFromPublic, type PublicViewingStats,
} from "@tentacle-tv/shared";
import { EmptyState } from "../../ui/EmptyState";
import { ActivityChart } from "../../stats/ActivityChart";
import { RecordsGrid } from "../../stats/RecordsGrid";
import { StatsAbout } from "../../stats/StatsAbout";
import { GenresCard, MixCard } from "../../stats/StatsDistributions";
import { ListeningCard, OriginsCard } from "../../stats/StatsLanguages";
import { MoviesSection } from "../../stats/StatsMovies";
import { StatsOverview } from "../../stats/StatsOverview";
import { StatsPairs } from "../../stats/StatsPairs";
import { StatsPersona } from "../../stats/StatsPersona";
import { StatsSection } from "../../stats/StatsSection";
import { PeopleSection, SeriesRail } from "../../stats/StatsTitleRails";
import { PublicTasteSection } from "../../stats/TasteSection";
import { useStatsFormat } from "../../stats/useStatsFormat";
import { MomentsCard } from "./MomentsCard";

/** Sous une minute, une période n'a rien à raconter — la règle de la page du propriétaire. */
const NOISE_SECONDS = 60;

/**
 * Les statistiques partagées, avec les cartes de « Vos statistiques » — même
 * ordre, même facture — dans la voix publique (posée par l'appelant). Ce que
 * la réponse publique ne porte pas n'a pas de carte : ni rythme heure par
 * heure (les grands moments de la journée le remplacent), ni écrans, ni
 * « À voir ». Aucun geste n'y suppose une session.
 */
export const PublicStatsBody = memo(function PublicStatsBody({ stats }: { stats: PublicViewingStats }) {
  const f = useStatsFormat();
  const view = useMemo(() => viewingStatsFromPublic(stats), [stats]);
  const rhythm = useMemo(() => habitsInsight(stats.habits), [stats.habits]);

  if (!stats.hasHistory) {
    return <EmptyState icon={<BarChart3 size={26} />} title={f.t("emptyTitle")} description={f.t("emptyBody")} />;
  }
  const empty = stats.totals.seconds < NOISE_SECONDS && stats.totals.movies + stats.totals.episodes === 0;
  const { movieSeconds, seriesSeconds, animeSeconds } = stats.split;

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <StatsOverview stats={view} period={stats.period} pending={false} counters={!empty} />
      {empty ? (
        <EmptyState icon={<CalendarSearch size={26} />} title={f.t("periodEmptyTitle")} description={f.t("periodEmptyBody")} />
      ) : (
        <>
          <StatsPersona stats={view} rhythm={rhythm} />
          <StatsSection title={f.t("activityTitle")} hint={f.t(`activityHint_${stats.timeline.unit}`)}>
            <ActivityChart timeline={stats.timeline} />
          </StatsSection>
          <StatsPairs
            cards={[
              [stats.habits.measuredSeconds >= BADGES_MIN_SECONDS, <MomentsCard key="moments" habits={stats.habits} />],
              [stats.genres.length > 0, <GenresCard key="genres" stats={view} />],
              [movieSeconds + seriesSeconds + animeSeconds > 0 || stats.decades.length > 0, <MixCard key="mix" stats={view} />],
              [stats.origins.countries.length > 0, <OriginsCard key="origins" stats={view} />],
              [listeningState(stats.listening) !== "hidden", <ListeningCard key="listening" stats={view} />],
            ]}
          />
          <MoviesSection stats={view} />
          <SeriesRail stats={view} />
          <PeopleSection stats={view} />
          <RecordsGrid records={stats.records} />
        </>
      )}
      <PublicTasteSection taste={view.taste} />
      <StatsAbout stats={view} />
    </div>
  );
});
