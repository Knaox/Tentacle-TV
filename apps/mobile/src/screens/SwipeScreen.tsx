import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { swipeLangOf, useSwipeCardDetails, useSwipeDeck } from "@tentacle-tv/api-client";
import type { SwipeVerdict } from "@tentacle-tv/api-client";
import { Skeleton } from "@/components/ui";
import { useHeaderHeight } from "@/components/PersistentHeader";
import { useGlassTabBarHeight } from "@/components/navigation/GlassTabBar";
import { SwipeControls } from "@/components/swipe/SwipeControls";
import { SwipeDeckView, type ExitingCard } from "@/components/swipe/SwipeDeckView";
import { SwipeHeaderNative } from "@/components/swipe/SwipeHeaderNative";
import { SwipeEmptyNative, SwipeErrorNative, SwipeSaveFailedNative } from "@/components/swipe/SwipeStatesNative";
import { motion, useTheme } from "@/theme";

const HAPTIC: Record<SwipeVerdict, () => Promise<void>> = {
  like: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  dislike: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  superlike: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  skip: () => Haptics.selectionAsync(),
};

/**
 * La section « Affiner » de l'onglet Pour vous : une pile de films et de
 * séries — de la bibliothèque et d'ailleurs — à juger d'un glisser (droite,
 * gauche, haut, bas) ou d'un bouton. La logique (file, annulation, écritures) est
 * celle du web (useSwipeDeck) ; seuls le geste et le rendu sont natifs.
 */
export function SwipeScreen({ sectionSwitch }: { sectionSwitch?: ReactNode }) {
  const { t, i18n } = useTranslation("swipe");
  const theme = useTheme();
  const headerH = useHeaderHeight();
  const tabBarH = useGlassTabBarHeight();
  const lang = swipeLangOf(i18n.language);
  const deck = useSwipeDeck(lang);
  const [infoOpen, setInfoOpen] = useState(false);
  const [exiting, setExiting] = useState<ExitingCard[]>([]);
  const nextId = useRef(0);
  const reducedMotion = motion.isReducedMotion();
  const top = deck.cards[0];
  const { data: details } = useSwipeCardDetails(top, lang);
  // Le verso de la suivante se charge pendant qu'on juge celle-ci, et elle le
  // porte déjà : son texte ne change pas au moment où elle monte en tête.
  const { data: nextDetails } = useSwipeCardDetails(deck.cards[1], lang);
  const topKey = top?.key;
  useEffect(() => {
    setInfoOpen(false);
  }, [topKey]);

  const { judge, undo, dismissSaveFailed, saveFailed } = deck;
  useEffect(() => {
    if (!saveFailed) return;
    const id = setTimeout(dismissSaveFailed, 5000);
    return () => clearTimeout(id);
  }, [saveFailed, dismissSaveFailed]);

  // Le verdict est posé TOUT DE SUITE (la suivante est jouable) ; la carte
  // elle-même finit son mouvement par-dessus, avec sa face du moment.
  const commit = useCallback((verdict: SwipeVerdict) => {
    if (!top) return;
    void HAPTIC[verdict]().catch(() => {});
    setExiting((list) => [...list, { id: nextId.current++, card: top, verdict, details, infoOpen }]);
    AccessibilityInfo.announceForAccessibility(`${t(verdict)} — ${top.title}`);
    judge(verdict);
  }, [top, details, infoOpen, judge, t]);
  // Une carte revenue dans la pile (annuler, échec d'enregistrement) n'est
  // plus en partance : elle a déjà repris sa place, son entrée s'efface.
  const cards = deck.cards;
  useEffect(() => {
    setExiting((list) => {
      const kept = list.filter((e) => !cards.some((c) => c.key === e.card.key));
      return kept.length === list.length ? list : kept;
    });
  }, [cards]);
  const onUndo = useCallback(() => {
    void Haptics.selectionAsync().catch(() => {});
    AccessibilityInfo.announceForAccessibility(t("undone"));
    undo();
  }, [undo, t]);
  const onExited = useCallback((id: number) => setExiting((list) => list.filter((e) => e.id !== id)), []);
  const onToggleInfo = useCallback(() => setInfoOpen((v) => !v), []);

  return (
    <View style={[st.screen, { backgroundColor: theme.colors.surface.s0, paddingTop: headerH, paddingBottom: tabBarH + 12 }]}>
      {sectionSwitch}
      <SwipeHeaderNative counts={deck.counts} libraryOnly={!deck.tmdbConfigured} />
      {deck.loading ? (
        <View style={st.skeleton}>
          <Skeleton width="72%" height={420} radius={26} />
        </View>
      ) : deck.error ? (
        <SwipeErrorNative onRetry={deck.retry} />
      ) : deck.empty ? (
        <SwipeEmptyNative />
      ) : (
        <SwipeDeckView
          cards={deck.cards}
          exiting={exiting}
          infoOpen={infoOpen}
          details={details}
          nextDetails={nextDetails}
          reducedMotion={reducedMotion}
          onRelease={commit}
          onExited={onExited}
          onToggleInfo={onToggleInfo}
        />
      )}
      {saveFailed && <SwipeSaveFailedNative />}
      {!deck.error && (!deck.empty || deck.canUndo) && (
        <SwipeControls disabled={!top} canUndo={deck.canUndo} onJudge={commit} onUndo={onUndo} />
      )}
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, gap: 8 },
  skeleton: { flex: 1, alignItems: "center", justifyContent: "center" },
});
