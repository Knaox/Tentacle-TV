import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRefreshViewingStats, useViewingStats, viewingStatsFailure } from "@tentacle-tv/api-client";
import { statsLocale, VIEWING_STATS_PERIODS, type ViewingStatsPeriod } from "@tentacle-tv/shared";
import { SubtleBackground } from "@/components/ui";
import { FloatingBackButton } from "@/components/navigation/FloatingBackButton";
import { StatsHeader } from "@/components/stats/StatsHeader";
import { StatsFailure, StatsNeverWatched, StatsSkeleton } from "@/components/stats/StatsStates";
import { backOrHome } from "@/utils/backOrHome";
import { spacing, useContentPadding, useTheme } from "@/theme";
import { StatsBody } from "./stats/StatsBody";

/** Au-delà, deux colonnes de cartes (tablette, téléphone couché large). */
const WIDE_MIN = 700;

const parsePeriod = (raw: unknown): ViewingStatsPeriod =>
  VIEWING_STATS_PERIODS.includes(raw as ViewingStatsPeriod) ? (raw as ViewingStatsPeriod) : "all";

/**
 * « Vos statistiques » — ce que vous avez regardé, quand, comment, et ce que
 * vos recommandations ont appris de vous : la page du web, à la forme des
 * écrans empilés de l'app (le retour flottant, tirer pour rafraîchir), aux
 * couleurs de l'app — plus aucune image de titre en en-tête.
 * `?period=30d|year` ouvre sur une période.
 *
 * Changer de période garde l'écran, estompé, le temps de la réponse ; tirer
 * vers le bas fait recalculer le serveur (au plus une fois toutes les 30 s).
 */
export function StatsScreen() {
  const { t, i18n } = useTranslation("stats");
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ period?: string }>();
  const [period, setPeriod] = useState<ViewingStatsPeriod>(() => parsePeriod(params.period));
  const locale = statsLocale(i18n.language);
  const query = useViewingStats(period, locale);
  const refresh = useRefreshViewingStats();
  const [pulling, setPulling] = useState(false);
  const { width } = useWindowDimensions();
  const padding = useContentPadding(1000);
  const wide = width - padding * 2 >= WIDE_MIN;
  const posterWidth = wide ? 136 : 112;
  const top = Math.max(insets.top, 24);
  const stats = query.data;

  const onPull = useCallback(() => {
    setPulling(true);
    void refresh(period, locale).catch(() => undefined).finally(() => setPulling(false));
  }, [refresh, period, locale]);

  let body;
  if (!stats) {
    body = query.isError
      ? <StatsFailure outdated={viewingStatsFailure(query.error) === "outdated"} onRetry={() => void query.refetch()} />
      : <StatsSkeleton />;
  } else if (!stats.hasHistory) {
    body = <StatsNeverWatched />;
  } else {
    body = (
      <StatsBody
        stats={stats}
        period={period}
        onPeriodChange={setPeriod}
        pending={query.isPlaceholderData}
        wide={wide}
        posterWidth={posterWidth}
        inset={padding}
      />
    );
  }

  return (
    <SubtleBackground ambient>
      <View style={st.container}>
        <ScrollView
          contentContainerStyle={{ paddingTop: top, paddingBottom: insets.bottom + spacing.xxxl + 60 }}
          refreshControl={stats ? <RefreshControl refreshing={pulling} onRefresh={onPull} tintColor={theme.colors.brand.violet} /> : undefined}
          showsVerticalScrollIndicator={false}
        >
          <StatsHeader title={t("title")} kicker={t("kicker")} topInset={top} inset={padding} />
          <View style={{ paddingHorizontal: padding }}>{body}</View>
        </ScrollView>
        <FloatingBackButton top={top} onPress={() => backOrHome(router)} />
      </View>
    </SubtleBackground>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
});
