import { useCallback, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react-native";
import {
  ratingKey, useColdStartTitles, useDeleteRating, useMyRatings, useRateItem, useRecoWarmup,
} from "@tentacle-tv/api-client";
import type { ColdStartTitle, RatingIdentity } from "@tentacle-tv/api-client";
import { Button, FadeIn, ProgressBar, Skeleton } from "@/components/ui";
import { useHeaderHeight } from "@/components/PersistentHeader";
import { useGlassTabBarHeight } from "@/components/navigation/GlassTabBar";
import { useScrollChromeHandler } from "@/components/navigation/scrollChrome";
import {
  spacing, typography, FONT_FAMILY, RADIUS, SHADOW_RN, useGrid, useResponsive, useTheme, useThemedStyles, type AppTheme,
} from "@/theme";
import { ColdStartCard } from "./ColdStartCard";

/** Un « j'aime » de la grille vaut 8/10 : signal franc, qui laisse le 9 et le
 *  10 aux coups de cœur notés finement sur les fiches. */
const LIKE_SCORE = 8;
const PAGE_SIZE = 24;
const TARGET = 5;
const PILL_H = 56;

function identityOf(title: ColdStartTitle): RatingIdentity {
  return { mediaType: title.mediaType === "tv" ? "series" : "movie", tmdbId: title.tmdbId };
}

interface Props {
  signalCount: number;
  /** « Voir mes recommandations » : le corps de la page prend le relais. */
  onDone: () => void;
  /** « Plus tard » : retour à l'accueil, la grille ne s'impose plus. */
  onLater: () => void;
}

/**
 * Démarrage à froid : sous cinq signaux, pas de recommandation personnalisée —
 * à la place, une sélection en UN appui de titres aimés, représentative de la
 * bibliothèque entière. La bascule vers les rangées est VOLONTAIRE : une
 * pilule collée au-dessus de la barre, jamais un écran qui se dérobe.
 */
export function ColdStartScreen({ signalCount, onDone, onLater }: Props) {
  const { t } = useTranslation("reco");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const headerH = useHeaderHeight();
  const onScrollChrome = useScrollChromeHandler();
  const insets = useSafeAreaInsets();
  const tabBarH = useGlassTabBarHeight();
  const { isTablet, isLandscape } = useResponsive();
  const grid = useGrid({ phoneColumns: 3 });
  // iPad paysage : rail à gauche, pas de barre basse → seule la zone sûre compte.
  const pillBottom = (isTablet && isLandscape ? insets.bottom : tabBarH) + 12;

  const { data, isPending } = useColdStartTitles(true);
  const { data: ratings } = useMyRatings();
  const rate = useRateItem();
  const remove = useDeleteRating();
  const warmup = useRecoWarmup();
  const [visible, setVisible] = useState(PAGE_SIZE);

  const items = useMemo(() => data?.items ?? [], [data]);
  const ratedKeys = useMemo(() => new Set((ratings ?? []).map((r) => ratingKey(r))), [ratings]);
  const pickedHere = items.filter((i) => ratedKeys.has(ratingKey(identityOf(i)))).length;
  // Progression : signaux déjà au profil + choix de la grille (le profil,
  // recalculé derrière un debounce, ne les compte pas encore).
  const progress = signalCount + pickedHere;
  const ready = progress >= TARGET;

  const toggle = useCallback((title: ColdStartTitle, selected: boolean) => {
    const identity = identityOf(title);
    if (selected) remove.mutate(identity);
    else rate.mutate({ ...identity, jellyfinItemId: title.jellyfinItemId, score: LIKE_SCORE });
  }, [rate, remove]);

  // Bascule INSTANTANÉE : le serveur répond 202 et reconstruit en fond — on
  // n'attend rien, le corps de la page prend le relais (squelettes + bandeau).
  const finish = () => {
    warmup.mutate();
    onDone();
  };

  return (
    <View style={st.root}>
      <Animated.ScrollView
        onScroll={onScrollChrome}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: headerH + spacing.md, paddingBottom: pillBottom + PILL_H + spacing.xl }}
      >
        <View style={[st.head, { paddingHorizontal: grid.padding }]}>
          <View style={st.kicker}>
            <Sparkles size={14} color={theme.colors.brand.light} />
            <Text style={st.kickerTxt}>{t("coldKicker")}</Text>
          </View>
          <Text style={st.title}>{t("coldTitle")}</Text>
          <Text style={st.body}>{t("coldBody")}</Text>
          <View style={st.progressRow}>
            <ProgressBar progress={Math.min(progress / TARGET, 1)} height={6} showEmpty style={st.progressBar} />
            <Text style={st.progressTxt} accessibilityLiveRegion="polite">
              {t("coldProgress", { count: Math.min(progress, TARGET) })}
            </Text>
            <Pressable onPress={onLater} hitSlop={10} accessibilityRole="button" style={st.later}>
              <Text style={st.laterTxt}>{t("coldLater")}</Text>
            </Pressable>
          </View>
        </View>

        <View style={[st.grid, { paddingHorizontal: grid.padding, gap: grid.gutter }]}>
          {isPending
            ? Array.from({ length: grid.numColumns * 3 }, (_, i) => (
                <View key={i} style={{ width: grid.itemWidth }}>
                  <Skeleton width={grid.itemWidth} height={grid.itemWidth * 1.5} radius={RADIUS.lg} />
                  <Skeleton width={grid.itemWidth * 0.7} height={12} style={{ marginTop: 10 }} />
                </View>
              ))
            : items.slice(0, visible).map((title) => (
                <ColdStartCard
                  key={title.jellyfinItemId}
                  title={title}
                  width={grid.itemWidth}
                  selected={ratedKeys.has(ratingKey(identityOf(title)))}
                  onToggle={toggle}
                />
              ))}
        </View>

        {!isPending && visible < items.length && (
          <View style={st.more}>
            <Button title={t("coldMore")} variant="ghost" onPress={() => setVisible((v) => v + PAGE_SIZE)} />
          </View>
        )}
      </Animated.ScrollView>

      {/* Bascule volontaire : la pilule reste au-dessus de la barre dès que le
          compte y est — la grille ne se dérobe jamais toute seule. */}
      {ready && (
        <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, st.pillLayer, { paddingBottom: pillBottom }]}>
          <FadeIn translateY={12}>
            <View style={st.pill}>
              <Text style={st.pillHint} numberOfLines={1}>{t("coldReadyHint")}</Text>
              <Button title={t("coldCta")} onPress={finish} />
            </View>
          </FadeIn>
        </View>
      )}
    </View>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  root: { flex: 1 },
  head: { maxWidth: 720, gap: spacing.sm, marginBottom: spacing.xl },
  kicker: { flexDirection: "row" as const, alignItems: "center" as const, gap: 6 },
  kickerTxt: { ...typography.badge, fontFamily: FONT_FAMILY.bold, color: t.colors.brand.light, letterSpacing: 1.2, textTransform: "uppercase" as const },
  title: { ...typography.title, fontFamily: FONT_FAMILY.extrabold, color: t.colors.text.primary, letterSpacing: -0.5 },
  body: { ...typography.body, color: t.colors.text.secondary },
  progressRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: spacing.md, marginTop: spacing.sm },
  progressBar: { width: 140 },
  progressTxt: { ...typography.caption, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary },
  later: { marginLeft: "auto" as const, minHeight: 44, justifyContent: "center" as const, paddingHorizontal: 4 },
  laterTxt: { ...typography.caption, fontFamily: FONT_FAMILY.medium, color: t.colors.text.tertiary },
  grid: { flexDirection: "row" as const, flexWrap: "wrap" as const, rowGap: spacing.lg },
  more: { alignItems: "center" as const, marginTop: spacing.xl },
  pillLayer: { justifyContent: "flex-end" as const, alignItems: "center" as const },
  pill: {
    flexDirection: "row" as const, alignItems: "center" as const, gap: spacing.md,
    minHeight: PILL_H, paddingLeft: spacing.lg, paddingRight: spacing.sm, paddingVertical: 6,
    marginHorizontal: spacing.screenPadding, maxWidth: 520,
    borderRadius: RADIUS.pill, backgroundColor: t.colors.surface.s1,
    borderWidth: StyleSheet.hairlineWidth, borderColor: t.colors.border.subtle,
    ...SHADOW_RN.sheet,
  },
  pillHint: { ...typography.caption, color: t.colors.text.secondary, flexShrink: 1 },
});
