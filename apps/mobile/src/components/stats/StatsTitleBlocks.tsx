import { memo, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useJellyfinClient, type JellyfinClient } from "@tentacle-tv/api-client";
import type { ViewingStats, ViewingStatsTitle } from "@tentacle-tv/shared";
import { FONT_FAMILY, spacing, useThemedStyles, type AppTheme } from "@/theme";
import { PeopleRail } from "./PeopleRail";
import { StatsBlock } from "./StatsBlock";
import { TitleRail, type RailTitle } from "./TitleRail";
import { useStatsFormat } from "./useStatsFormat";

function posterOf(client: JellyfinClient, title: ViewingStatsTitle): string {
  return client.getImageUrl(title.id, "Primary", {
    width: 300,
    quality: 80,
    ...(title.primaryTag ? { tag: title.primaryTag } : {}),
  });
}

interface RailProps {
  stats: ViewingStats;
  posterWidth: number;
  inset: number;
}

/** Vos séries — les plus regardées de la période, rang en grands chiffres. */
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
        imageUrl: posterOf(client, s),
        onPress: () => router.push(`/media/${s.id}`),
      })),
    [stats.topSeries, f, client, router]
  );
  if (items.length === 0) return null;
  return (
    <StatsBlock title={f.t("seriesTitle")} bare>
      <TitleRail items={items} ranked posterWidth={posterWidth} inset={inset} />
    </StatsBlock>
  );
});

/** Vos films — ceux de la période, le plus récent d'abord. */
export const MoviesBlock = memo(function MoviesBlock({ stats, posterWidth, inset }: RailProps) {
  const f = useStatsFormat();
  const client = useJellyfinClient();
  const router = useRouter();
  const items: RailTitle[] = useMemo(
    () =>
      stats.movies.map((m) => ({
        key: m.id,
        title: m.name,
        caption: m.lastPlayedAt ? f.t("movieSeenOn", { date: f.isoDay(m.lastPlayedAt) }) : f.duration(m.seconds),
        chip: m.viewings >= 2 ? f.t("movieViewings", { count: m.viewings }) : undefined,
        imageUrl: posterOf(client, m),
        onPress: () => router.push(`/media/${m.id}`),
      })),
    [stats.movies, f, client, router]
  );
  if (items.length === 0) return null;
  return (
    <StatsBlock title={f.t("moviesTitle")} bare>
      <TitleRail items={items} posterWidth={posterWidth} inset={inset} />
    </StatsBlock>
  );
});

/** Vos têtes d'affiche — les acteurs, puis la réalisation et la création. */
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
