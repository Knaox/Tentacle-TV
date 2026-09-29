import { memo, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  CalendarHeart, Clapperboard, Compass, Drama, Flame, Globe, Headphones, Heart, Hourglass, Moon, Repeat, Sparkles, Sunrise, Tv,
  type LucideIcon,
} from "lucide-react-native";
import { viewerBadges, type ViewerBadgeKey, type ViewingStats } from "@tentacle-tv/shared";
import { FONT_FAMILY, RADIUS, spacing, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { StatsBlock } from "./StatsBlock";
import { useStatsFormat } from "./useStatsFormat";

/** Les icônes du web (`StatsPersona`), à l'identique. */
const BADGE_ICONS: Record<ViewerBadgeKey, LucideIcon> = {
  nightOwl: Moon,
  earlyBird: Sunrise,
  weekend: CalendarHeart,
  binger: Flame,
  regular: Repeat,
  cinephile: Clapperboard,
  seriesAddict: Tv,
  animeFan: Sparkles,
  loyal: Heart,
  explorer: Compass,
  vintage: Hourglass,
  polyglot: Headphones,
  worldly: Globe,
};

interface Trait {
  key: string;
  Icon: LucideIcon;
  title: string;
  detail: string;
}

/**
 * « Votre profil de spectateur » : le genre de prédilection, puis trois
 * traits au plus, chacun avec le chiffre qui le justifie — tous à la même
 * enseigne, sans aplat de couleur. Sur trop peu de données, rien n'est
 * inventé : la section se réduit au genre, ou disparaît.
 */
export const StatsPersona = memo(function StatsPersona({ stats, wide }: { stats: ViewingStats; wide: boolean }) {
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const f = useStatsFormat();
  const traits = useMemo(() => {
    const out: Trait[] = [];
    const genre = stats.genres[0];
    if (genre) {
      out.push({
        key: "genre",
        Icon: Drama,
        title: genre.label,
        detail: `${f.t("favoriteGenre")} · ${f.t("favoriteGenreDetail", { share: f.percent(genre.share) })}`,
      });
    }
    for (const badge of viewerBadges(stats)) {
      out.push({
        key: badge.key,
        Icon: BADGE_ICONS[badge.key],
        title: f.t(`badge_${badge.key}`),
        detail: f.t(`badgeDetail_${badge.key}`, {
          share: badge.share !== undefined ? f.percent(badge.share) : "",
          count: badge.count ?? 0,
          label: badge.label ?? "",
          duration: badge.seconds !== undefined ? f.duration(badge.seconds) : "",
        }),
      });
    }
    return out;
  }, [stats, f]);
  if (traits.length === 0) return null;

  return (
    <StatsBlock title={f.t("personaTitle")} hint={f.t("personaHint")}>
      <View style={st.grid}>
        {traits.map(({ key, Icon, title, detail }) => (
          <View key={key} style={[st.trait, { flexBasis: wide ? "47%" : "100%" }]} accessible accessibilityLabel={`${title}. ${detail}`}>
            <View style={st.icon}>
              <Icon size={18} color={theme.colors.brand.light} strokeWidth={2} />
            </View>
            <View style={st.texts}>
              <Text style={st.title}>{title}</Text>
              <Text style={st.detail}>{detail}</Text>
            </View>
          </View>
        ))}
      </View>
    </StatsBlock>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: spacing.lg },
    trait: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
    icon: { width: 36, height: 36, borderRadius: RADIUS.lg, alignItems: "center", justifyContent: "center", backgroundColor: t.colors.fill.soft },
    texts: { flex: 1, minWidth: 0 },
    title: { fontSize: 15, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary },
    detail: { marginTop: 2, fontSize: 13, lineHeight: 18, fontFamily: FONT_FAMILY.regular, color: t.colors.text.secondary },
  });
