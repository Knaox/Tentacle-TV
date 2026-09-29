import { memo, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useJellyfinClient, type JellyfinClient } from "@tentacle-tv/api-client";
import { titleReasons, type ViewingStats, type ViewingStatsTitle } from "@tentacle-tv/shared";
import { FONT_FAMILY, spacing, useThemedStyles, type AppTheme } from "@/theme";
import { PeopleRail } from "./PeopleRail";
import { reasonChips } from "./ReasonChips";
import { StatsBlock } from "./StatsBlock";
import { TitleRail, type RailTitle } from "./TitleRail";
import { useStatsFormat } from "./useStatsFormat";

export function posterOf(client: JellyfinClient, title: ViewingStatsTitle, width = 300): string {
  return client.getImageUrl(title.id, "Primary", {
    width,
    quality: 80,
    ...(title.primaryTag ? { tag: title.primaryTag } : {}),
  });
}

export interface RailProps {
  stats: ViewingStats;
  posterWidth: number;
  inset: number;
}

/** Vos séries — les plus regardées de la période, au temps passé ; le rang en pastille. */
export const SeriesBlock = memo(function SeriesBlock({ stats, posterWidth, inset }: RailProps) {
  const f = useStatsFormat();
  const client = useJellyfinClient();
  const router = useRouter();
  const items: RailTitle[] = useMemo(
    () =>
      stats.topSeries.map((s) => ({
        key: s.id,
        title: s.name,
        caption: [s.episodes > 0 ? f.t("seriesEpisodes", { count: s.episodes }) : null, s.seconds >= 60 ? f.duration(s.seconds) : null]
          .filter(Boolean)
          .join(" · "),
        chips: reasonChips(f, titleReasons(s)),
        imageUrl: posterOf(client, s),
        onPress: () => router.push(`/media/${s.id}`),
      })),
    [stats.topSeries, f, client, router]
  );
  if (items.length === 0) return null;
  return (
    <StatsBlock title={f.t("seriesTitle")} hint={f.t("seriesHint")} bare>
      <TitleRail items={items} firstRank={1} posterWidth={posterWidth} inset={inset} />
    </StatsBlock>
  );
});

/**
 * Vos têtes d'affiche — classées au nombre de TITRES où on les retrouve (une
 * série compte pour un), puis au temps passé ; la réalisation ensuite.
 */
export const PeopleBlock = memo(function PeopleBlock({ stats, inset }: { stats: ViewingStats; inset: number }) {
  const st = useThemedStyles(makeStyles);
  const f = useStatsFormat();
  const { actors, directors } = stats.people;
  if (actors.length === 0 && directors.length === 0) return null;
  return (
    <StatsBlock title={f.t("peopleTitle")} hint={f.t("peopleHint")} bare>
      <View style={st.stack}>
        {actors.length > 0 ? (
          <View>
            <Text style={st.sub}>{f.t("actorsTitle")}</Text>
            <PeopleRail people={actors} inset={inset} />
          </View>
        ) : null}
        {directors.length > 0 ? (
          <View>
            <Text style={st.sub}>{f.t("directorsTitle")}</Text>
            <PeopleRail people={directors} inset={inset} />
          </View>
        ) : null}
      </View>
    </StatsBlock>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    stack: { gap: spacing.lg },
    sub: { marginBottom: spacing.sm, fontSize: 14, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.secondary },
  });
