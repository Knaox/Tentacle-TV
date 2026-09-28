import { memo, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { ViewingStatsSignals, ViewingStatsTaste, ViewingStatsTasteTitle } from "@tentacle-tv/shared";
import { useRecoNavigation } from "@/hooks/useRecoNavigation";
import { FONT_FAMILY, RADIUS, spacing, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { StatsBlock } from "./StatsBlock";
import { TitleRail, type RailTitle } from "./TitleRail";
import { useStatsFormat, type StatsFormat } from "./useStatsFormat";

const TMDB_POSTER = "https://image.tmdb.org/t/p/w342";
const SIGNALS: Array<keyof Omit<ViewingStatsSignals, "ratingAverage">> = [
  "ratings", "superlikes", "likes", "dislikes", "likedPeople", "favorites",
];

function reasonText(f: StatsFormat, title: ViewingStatsTasteTitle): string {
  return title.reasons
    .slice(0, 2)
    .map((r) => (r === "rating" && title.rating !== null ? f.t("reason_rating", { rating: f.number(title.rating, title.rating % 1 ? 1 : 0) }) : f.t(`reason_${r}`)))
    .join(" · ");
}

/**
 * « Ce que vous aimez » — le profil du moteur de recommandations, montré tel
 * quel : les titres qui pèsent le plus dans le goût (et pourquoi), puis les
 * avis donnés, et « Affiner mes goûts » qui mène à la pile de Pour vous.
 */
export const TasteBlock = memo(function TasteBlock({ taste, posterWidth, inset }: { taste: ViewingStatsTaste; posterWidth: number; inset: number }) {
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const f = useStatsFormat();
  const router = useRouter();
  const client = useJellyfinClient();
  const { open, canOpen } = useRecoNavigation();

  const rail: RailTitle[] = useMemo(
    () =>
      taste.loved.map((l) => {
        const nav = { jellyfinItemId: l.jellyfinId, mediaType: l.mediaType, tmdbId: l.tmdbId };
        return {
          key: l.key,
          title: l.title,
          caption: reasonText(f, l),
          imageUrl: l.jellyfinId
            ? client.getImageUrl(l.jellyfinId, "Primary", { width: 300, quality: 80 })
            : l.posterPath ? `${TMDB_POSTER}${l.posterPath}` : null,
          onPress: l.jellyfinId || (l.tmdbId > 0 && canOpen(nav)) ? () => open(nav) : undefined,
        };
      }),
    [taste.loved, f, client, open, canOpen]
  );

  const refine = (
    <Pressable
      onPress={() => router.push({ pathname: "/for-you", params: { section: "refine" } })}
      accessibilityRole="button"
      style={({ pressed }) => [st.refine, pressed && st.pressed]}
      hitSlop={6}
    >
      <Feather name="sliders" size={14} color={theme.colors.text.secondary} />
      <Text style={st.refineTxt}>{f.t("tasteRefine")}</Text>
    </Pressable>
  );
  const signals = SIGNALS.filter((k) => taste.signals[k] > 0);

  if (!taste.available || taste.loved.length === 0) {
    return (
      <StatsBlock title={f.t("tasteTitle")}>
        <Text style={st.unavailable}>{f.t("tasteUnavailable")}</Text>
        <View style={st.refineRow}>{refine}</View>
      </StatsBlock>
    );
  }

  return (
    <StatsBlock title={f.t("tasteTitle")} hint={f.t("tasteHint")} bare>
      <TitleRail items={rail} posterWidth={posterWidth} inset={inset} />
      {signals.length > 0 || taste.animeShare >= 0.05 ? (
        <View style={st.signals}>
          <Text style={st.signalsTitle}>{f.t("signalsTitle")}</Text>
          <View style={st.chips}>
            {signals.map((k) => (
              <View key={k} style={st.chip}>
                <Text style={st.chipValue}>{f.number(taste.signals[k])} </Text>
                <Text style={st.chipLabel}>{f.t(`signal_${k}`, { count: taste.signals[k] })}</Text>
                {k === "ratings" && taste.signals.ratingAverage !== null ? (
                  <Text style={st.chipMuted}>{` · ${f.t("signalAverage", { average: f.number(taste.signals.ratingAverage, 1) })}`}</Text>
                ) : null}
              </View>
            ))}
            {taste.animeShare >= 0.05 ? (
              <View style={st.chip}>
                <Text style={st.chipLabel}>{f.t("tasteAnime", { share: f.percent(taste.animeShare) })}</Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}
      <View style={st.refineRow}>{refine}</View>
    </StatsBlock>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    unavailable: { fontSize: 14, lineHeight: 20, fontFamily: FONT_FAMILY.regular, color: t.colors.text.tertiary },
    signals: { marginTop: spacing.sm },
    signalsTitle: { marginBottom: spacing.sm, fontSize: 14, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.secondary },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    chip: {
      flexDirection: "row",
      alignItems: "baseline",
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: RADIUS.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border.subtle,
      backgroundColor: t.colors.surface.s1,
    },
    chipValue: { fontSize: 14, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary },
    chipLabel: { fontSize: 14, fontFamily: FONT_FAMILY.regular, color: t.colors.text.secondary },
    chipMuted: { fontSize: 13, fontFamily: FONT_FAMILY.regular, color: t.colors.text.tertiary },
    refineRow: { flexDirection: "row", marginTop: spacing.md },
    refine: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      height: 40,
      paddingHorizontal: 16,
      borderRadius: RADIUS.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border.strong,
      backgroundColor: t.colors.surface.s2,
    },
    pressed: { opacity: 0.7 },
    refineTxt: { fontSize: 14, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.secondary },
  });
