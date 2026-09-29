import { memo, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { listeningState, type ViewingStats, type ViewingStatsPeriod } from "@tentacle-tv/shared";
import { ActivityChart } from "@/components/stats/ActivityChart";
import { RecordsBlock } from "@/components/stats/RecordsBlock";
import { RhythmHeatmap } from "@/components/stats/RhythmHeatmap";
import { StatsAbout } from "@/components/stats/StatsAbout";
import { StatsBlock } from "@/components/stats/StatsBlock";
import { DevicesBlock, GenresBlock, MixBlock } from "@/components/stats/StatsDistributions";
import { ListeningBlock, OriginsBlock } from "@/components/stats/StatsLanguages";
import { MoviesBlock } from "@/components/stats/StatsMovies";
import { PotentialTile } from "@/components/stats/PotentialTile";
import { StatsOverview } from "@/components/stats/StatsOverview";
import { StatsPersona } from "@/components/stats/StatsPersona";
import { StatsPeriodEmpty } from "@/components/stats/StatsStates";
import { PeopleBlock, SeriesBlock } from "@/components/stats/StatsTitleBlocks";
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
 * Deux cartes par rangée sur tablette, empilées au téléphone ; une carte
 * seule (l'autre n'a rien à dire) prend toute la largeur.
 */
function Pairs({ wide, cards }: { wide: boolean; cards: Array<[visible: boolean, node: ReactNode]> }) {
  const shown = cards.filter(([visible]) => visible).map(([, node]) => node);
  if (!wide) return <>{shown}</>;
  const rows: ReactNode[][] = [];
  for (let i = 0; i < shown.length; i += 2) rows.push(shown.slice(i, i + 2));
  return (
    <>
      {rows.map((row, i) => (
        <View key={i} style={st.row}>
          {row.map((node, j) => <View key={j} style={st.half}>{node}</View>)}
        </View>
      ))}
    </>
  );
}

/**
 * Le corps de l'écran de statistiques, dans l'ordre du web : la vue
 * d'ensemble, le profil, l'activité, le rythme et les écrans, les genres et
 * les formats, l'origine et « VF ou VO ? », les films préférés, les séries,
 * les visages, les records, puis le goût et d'où viennent les chiffres.
 */
export const StatsBody = memo(function StatsBody({ stats, period, onPeriodChange, pending, wide, posterWidth, inset }: Props) {
  const f = useStatsFormat();
  const empty = stats.totals.seconds < NOISE_SECONDS && stats.totals.movies + stats.totals.episodes === 0;
  const hasDevices = stats.devices.length > 0;
  const { movieSeconds, seriesSeconds, animeSeconds } = stats.split;

  const rhythm = (
    <StatsBlock title={f.t("rhythmTitle")}>
      <RhythmHeatmap grid={stats.rhythm.grid} />
    </StatsBlock>
  );

  return (
    <View style={st.stack}>
      <StatsOverview stats={stats} period={period} onPeriodChange={onPeriodChange} pending={pending} counters={!empty} wide={wide} />
      {empty ? (
        <StatsPeriodEmpty onShowAll={() => onPeriodChange("all")} />
      ) : (
        <View style={[st.stack, pending && st.pending]}>
          <StatsPersona stats={stats} wide={wide} />
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
          <Pairs
            wide={wide}
            cards={[
              [stats.genres.length > 0, <GenresBlock key="genres" stats={stats} />],
              [movieSeconds + seriesSeconds + animeSeconds > 0 || stats.decades.length > 0, <MixBlock key="mix" stats={stats} />],
              [stats.origins.countries.length > 0, <OriginsBlock key="origins" stats={stats} />],
              [listeningState(stats.listening) !== "hidden", <ListeningBlock key="listening" stats={stats} />],
            ]}
          />
          <MoviesBlock stats={stats} posterWidth={posterWidth} inset={inset} />
          <SeriesBlock stats={stats} posterWidth={posterWidth} inset={inset} />
          <PeopleBlock stats={stats} inset={inset} />
          <RecordsBlock records={stats.records} wide={wide} />
        </View>
      )}
      <TasteBlock taste={stats.taste} posterWidth={posterWidth} inset={inset} />
      <PotentialTile taste={stats.taste} />
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
