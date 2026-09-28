import { memo, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { viewerBadges, type ViewerBadge, type ViewerBadgeKey, type ViewingStats } from "@tentacle-tv/shared";
import { FONT_FAMILY, RADIUS, spacing, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { StatsBlock } from "./StatsBlock";
import { useStatsFormat } from "./useStatsFormat";

const BADGE_ICONS: Record<ViewerBadgeKey, keyof typeof Feather.glyphMap> = {
  nightOwl: "moon",
  earlyBird: "sunrise",
  weekend: "calendar",
  binger: "zap",
  regular: "repeat",
  cinephile: "film",
  seriesAddict: "tv",
  animeFan: "star",
  loyal: "heart",
  explorer: "compass",
  vintage: "clock",
  polyglot: "headphones",
  worldly: "globe",
};

const BadgeCard = memo(function BadgeCard({ badge }: { badge: ViewerBadge }) {
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const f = useStatsFormat();
  const title = f.t(`badge_${badge.key}`);
  const detail = f.t(`badgeDetail_${badge.key}`, {
    share: badge.share !== undefined ? f.percent(badge.share) : "",
    count: badge.count ?? 0,
    label: badge.label ?? "",
    duration: badge.seconds !== undefined ? f.duration(badge.seconds) : "",
  });
  return (
    <View style={st.badge} accessible accessibilityLabel={`${title}. ${detail}`}>
      <View style={[st.badgeIcon, { backgroundColor: theme.colors.brand.ghost }]}>
        <Feather name={BADGE_ICONS[badge.key]} size={19} color={theme.colors.brand.light} />
      </View>
      <View style={st.badgeTexts}>
        <Text style={st.badgeTitle}>{title}</Text>
        <Text style={st.badgeDetail}>{detail}</Text>
      </View>
    </View>
  );
});

/**
 * « Votre profil de spectateur » : le genre de prédilection en grand, puis
 * trois traits au plus, chacun avec le chiffre qui le justifie. Sur trop peu
 * de données, rien n'est inventé : la section se réduit au genre, ou
 * disparaît.
 */
export const StatsPersona = memo(function StatsPersona({ stats }: { stats: ViewingStats }) {
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const f = useStatsFormat();
  const badges = useMemo(() => viewerBadges(stats), [stats]);
  const genre = stats.genres[0];
  if (!genre && badges.length === 0) return null;
  return (
    <StatsBlock title={f.t("personaTitle")} hint={f.t("personaHint")} bare>
      <View style={st.stack}>
        {genre ? (
          <LinearGradient
            colors={[theme.colors.brand.dark, theme.colors.brand.violet, theme.colors.brand.accentDark]}
            locations={[0, 0.55, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={st.genre}
          >
            <View accessible accessibilityLabel={`${f.t("favoriteGenre")} : ${genre.label}, ${f.t("favoriteGenreDetail", { share: f.percent(genre.share) })}`}>
              <Text style={st.genreKicker}>{f.t("favoriteGenre")}</Text>
              <Text style={st.genreName}>{genre.label}</Text>
              <Text style={st.genreShare}>{f.t("favoriteGenreDetail", { share: f.percent(genre.share) })}</Text>
            </View>
          </LinearGradient>
        ) : null}
        {badges.map((b) => <BadgeCard key={b.key} badge={b} />)}
      </View>
    </StatsBlock>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    stack: { gap: spacing.sm },
    genre: { padding: spacing.lg, borderRadius: RADIUS.xl, overflow: "hidden" },
    genreKicker: { fontSize: 11, letterSpacing: 1.6, textTransform: "uppercase", fontFamily: FONT_FAMILY.semibold, color: "rgba(255,255,255,0.9)" },
    genreName: { marginTop: 6, fontSize: 28, lineHeight: 33, fontFamily: FONT_FAMILY.bold, color: "#FFFFFF" },
    genreShare: { marginTop: 2, fontSize: 14, fontFamily: FONT_FAMILY.medium, color: "rgba(255,255,255,0.95)" },
    badge: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: RADIUS.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border.subtle,
      backgroundColor: t.colors.surface.s1,
    },
    badgeIcon: { width: 42, height: 42, borderRadius: RADIUS.lg, alignItems: "center", justifyContent: "center" },
    badgeTexts: { flex: 1, minWidth: 0 },
    badgeTitle: { fontSize: 16, fontFamily: FONT_FAMILY.bold, color: t.colors.text.primary },
    badgeDetail: { marginTop: 2, fontSize: 13, lineHeight: 18, fontFamily: FONT_FAMILY.regular, color: t.colors.text.secondary },
  });
