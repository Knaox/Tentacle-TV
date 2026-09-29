import { memo, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { isLovedTitle, moviesRankMode, titleReasons, type ViewingStatsTitle } from "@tentacle-tv/shared";
import { FONT_FAMILY, RADIUS, spacing, useThemedStyles, type AppTheme } from "@/theme";
import { ReasonChips, reasonChips } from "./ReasonChips";
import { StatsBlock } from "./StatsBlock";
import { posterOf, type RailProps } from "./StatsTitleBlocks";
import { TitleRail, type RailTitle } from "./TitleRail";
import { useStatsFormat, type StatsFormat } from "./useStatsFormat";

/** « Vu 2 fois · 3 h 40 » — combien de fois, puis le temps passé. */
function movieCaption(f: StatsFormat, m: ViewingStatsTitle): string {
  return [m.viewings > 0 ? f.t("viewings", { count: m.viewings }) : null, m.seconds >= 60 ? f.duration(m.seconds) : null]
    .filter(Boolean)
    .join(" · ");
}

/** Le film préféré, mis en avant : l'affiche, le titre, combien de fois, et pourquoi. */
const FavoriteMovie = memo(function FavoriteMovie({ movie }: { movie: ViewingStatsTitle }) {
  const st = useThemedStyles(makeStyles);
  const f = useStatsFormat();
  const client = useJellyfinClient();
  const router = useRouter();
  const chips = reasonChips(f, titleReasons(movie));
  const caption = [movie.year ? String(movie.year) : null, movieCaption(f, movie)].filter(Boolean).join(" · ");
  return (
    <Pressable
      onPress={() => router.push(`/media/${movie.id}`)}
      accessibilityRole="button"
      accessibilityLabel={[f.t("favoriteMovie"), movie.name, caption, ...chips.map((c) => c.accessibilityLabel ?? c.label)].join(", ")}
      style={({ pressed }) => [st.card, pressed && st.pressed]}
    >
      <View style={st.poster}>
        <Image source={{ uri: posterOf(client, movie, 240) }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
      </View>
      <View style={st.texts}>
        <Text style={st.kicker}>{f.t("favoriteMovie")}</Text>
        <Text style={st.name} numberOfLines={2}>{movie.name}</Text>
        {caption ? <Text style={st.caption}>{caption}</Text> : null}
        {chips.length > 0 ? <View style={st.chips}><ReasonChips chips={chips} /></View> : null}
      </View>
    </Pressable>
  );
});

/**
 * Vos films préférés — le classement du web : critères dits sous le titre
 * (note, coups de cœur et favoris, revisionnages ; le temps départage),
 * chaque film avec son nombre de visionnages, le premier mis en avant s'il
 * a gagné sa place. Sans aucun avis, l'écran le dit ; un serveur plus ancien
 * trie par date, sans rang.
 */
export const MoviesBlock = memo(function MoviesBlock({ stats, posterWidth, inset }: RailProps) {
  const f = useStatsFormat();
  const client = useJellyfinClient();
  const router = useRouter();
  const mode = moviesRankMode(stats);
  const featured = mode === "preference" && stats.movies[0] && isLovedTitle(stats.movies[0]) ? stats.movies[0] : null;
  const items: RailTitle[] = useMemo(
    () =>
      (featured ? stats.movies.slice(1) : stats.movies).map((m) => ({
        key: m.id,
        title: m.name,
        caption: mode === "recent" && m.lastPlayedAt ? f.t("movieSeenOn", { date: f.isoDay(m.lastPlayedAt) }) : movieCaption(f, m),
        chips: reasonChips(f, titleReasons(m)),
        imageUrl: posterOf(client, m),
        onPress: () => router.push(`/media/${m.id}`),
      })),
    [stats.movies, featured, mode, f, client, router]
  );
  if (stats.movies.length === 0) return null;
  return (
    <StatsBlock title={f.t(mode === "preference" ? "moviesFavoritesTitle" : "moviesTitle")} hint={f.t(`moviesHint_${mode}`)} bare>
      {featured ? <FavoriteMovie movie={featured} /> : null}
      {items.length > 0 ? (
        <TitleRail items={items} firstRank={mode === "recent" ? undefined : featured ? 2 : 1} posterWidth={posterWidth} inset={inset} />
      ) : null}
    </StatsBlock>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    card: {
      flexDirection: "row",
      gap: spacing.md,
      marginBottom: spacing.md,
      padding: spacing.sm,
      paddingRight: spacing.lg,
      borderRadius: RADIUS.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border.subtle,
      backgroundColor: t.colors.surface.s1,
    },
    pressed: { opacity: 0.75 },
    poster: { width: 84, height: 126, borderRadius: RADIUS.lg, overflow: "hidden", backgroundColor: t.colors.fill.soft },
    texts: { flex: 1, minWidth: 0, justifyContent: "center" },
    kicker: { fontSize: 11, letterSpacing: 1.6, textTransform: "uppercase", fontFamily: FONT_FAMILY.bold, color: t.colors.brand.light },
    name: { marginTop: 4, fontSize: 19, lineHeight: 23, fontFamily: FONT_FAMILY.bold, color: t.colors.text.primary },
    caption: { marginTop: 4, fontSize: 14, fontFamily: FONT_FAMILY.regular, color: t.colors.text.secondary, fontVariant: ["tabular-nums"] },
    chips: { marginTop: spacing.sm },
  });
