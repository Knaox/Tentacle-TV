import { memo } from "react";
import { StyleSheet, View } from "react-native";
import type { ViewingStats, ViewingStatsPeriod } from "@tentacle-tv/shared";
import { ActivityChart } from "@/components/stats/ActivityChart";
import { RecordsBlock } from "@/components/stats/RecordsBlock";
import { RhythmHeatmap } from "@/components/stats/RhythmHeatmap";
import { StatsAbout } from "@/components/stats/StatsAbout";
import { StatsBlock } from "@/components/stats/StatsBlock";
import { DevicesBlock, GenresBlock, MixBlocks } from "@/components/stats/StatsDistributions";
import { StatsHeroFigure } from "@/components/stats/StatsHeroFigure";
import { StatsKpis } from "@/components/stats/StatsKpis";
import { StatsPersona } from "@/components/stats/StatsPersona";
import { StatsPeriodEmpty } from "@/components/stats/StatsStates";
import { MoviesBlock, PeopleBlock, SeriesBlock } from "@/components/stats/StatsTitleBlocks";
import { TasteBlock } from "@/components/stats/TasteBlock";
import { useStatsFormat } from "@/components/stats/useStatsFormat";
import { spacing } from "@/theme";

/** Sous une minute, une période n'a rien à raconter : une lecture d'essai n'est pas une activité. */
const NOISE_SECONDS = 60;

interface Props {
  stats: ViewingStats;
  period: ViewingStatsPeriod;
  onPeriodChange: (period: ViewingStatsPeriod) => void;
  /** Une autre période se charge : l'écran reste, estompé. */
  pending: boolean;
  /** Tablette : deux colonnes là où le téléphone empile. */
  wide: boolean;
  posterWidth: number;
  /** Marge latérale : les rangées d'affiches débordent jusqu'aux bords. */
  inset: number;
}

/**
 * Le corps de l'écran de statistiques, dans l'ordre du web : le chiffre, les
 * comptes, le profil de spectateur, l'activité, le rythme et les écrans, les
 * genres et la répartition, les séries, les films, les visages, les records,
 * puis le goût et d'où viennent les chiffres.
 */
export const StatsBody = memo(function StatsBody({ stats, period, onPeriodChange, pending, wide, posterWidth, inset }: Props) {
  const f = useStatsFormat();
  const empty = stats.totals.seconds < NOISE_SECONDS && stats.totals.movies + stats.totals.episodes === 0;
  const hasDevices = stats.devices.length > 0;

  const rhythm = (
    <StatsBlock title={f.t("rhythmTitle")}>
      <RhythmHeatmap grid={stats.rhythm.grid} />
    </StatsBlock>
  );

  return (
    <View style={st.stack}>
      <StatsHeroFigure stats={stats} period={period} onPeriodChange={onPeriodChange} pending={pending} />
      {empty ? (
        <StatsPeriodEmpty onShowAll={() => onPeriodChange("all")} />
      ) : (
        <View style={[st.stack, pending && st.pending]}>
          <StatsKpis totals={stats.totals} wide={wide} />
          <StatsPersona stats={stats} />
          <StatsBlock title={f.t("activityTitle")} hint={f.t(`activityHint_${stats.timeline.unit}`)}>
            <ActivityChart key={period} timeline={stats.timeline} />
          </StatsBlock>
          {wide && hasDevices ? (
            <View style={st.row}>
              <View style={st.twoThirds}>{rhythm}</View>
              <View style={st.oneThird}><DevicesBlock stats={stats} /></View>
            </View>
          ) : (
            <>
              {rhythm}
              <DevicesBlock stats={stats} />
            </>
          )}
          {wide ? (
            <View style={st.row}>
              <View style={st.half}><GenresBlock stats={stats} /></View>
              <View style={st.half}><MixBlocks stats={stats} /></View>
            </View>
          ) : (
            <>
              <GenresBlock stats={stats} />
              <MixBlocks stats={stats} />
            </>
          )}
          <SeriesBlock stats={stats} posterWidth={posterWidth} inset={inset} />
          <MoviesBlock stats={stats} posterWidth={posterWidth} inset={inset} />
          <PeopleBlock stats={stats} inset={inset} />
          <RecordsBlock records={stats.records} wide={wide} />
        </View>
      )}
      <TasteBlock taste={stats.taste} posterWidth={posterWidth} inset={inset} />
      <StatsAbout stats={stats} />
    </View>
  );
});

const st = StyleSheet.create({
  stack: { gap: spacing.lg },
  pending: { opacity: 0.6 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: spacing.lg },
  half: { flex: 1 },
  twoThirds: { flex: 2 },
  oneThird: { flex: 1 },
});
