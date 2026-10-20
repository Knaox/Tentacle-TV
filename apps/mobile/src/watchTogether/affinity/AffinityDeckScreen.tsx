import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { PartyPopper } from "lucide-react-native";
import { swipeLangOf, useAffinityDeck, useSwipeCardDetails } from "@tentacle-tv/api-client";
import type { SwipeVerdict } from "@tentacle-tv/api-client";
import type { WtAffinityStateDto, WtRoomStateDto } from "@tentacle-tv/shared";
import { Skeleton } from "@/components/ui";
import { SwipeControls } from "@/components/swipe/SwipeControls";
import { SwipeDeckView, type ExitingCard } from "@/components/swipe/SwipeDeckView";
import { SwipeErrorNative, SwipeSaveFailedNative } from "@/components/swipe/SwipeStatesNative";
import { FONT_FAMILY, RADIUS, motion, useThemedStyles, type AppTheme } from "@/theme";
import { haptic } from "@/utils/haptics";
import { AffinityHeaderNative } from "./AffinityHeaderNative";

/** Ni verso ni synopsis dans le swipe de groupe : rien à basculer. */
const noop = () => undefined;

/**
 * La pile de l'affinité sur le mobile : la mécanique d'« Affiner » réduite à
 * trois gestes — j'aime (droite), pas pour moi (gauche), annuler —, nourrie
 * par la pile COMMUNE du groupe (`useAffinityDeck`). Monter la vue, c'est
 * rejoindre la séance. `paused` : un match la recouvre, elle reste montée.
 */
export function AffinityDeckScreen({ state, room, selfId, onQuit, onStale, onMatch, onChangeKind }: {
  state: WtAffinityStateDto;
  room: WtRoomStateDto | null;
  selfId: string | null;
  onQuit: () => void;
  onStale: () => void;
  /** Mon verdict a fait un match : l'état qui le porte. */
  onMatch: (state: WtAffinityStateDto) => void;
  onChangeKind: () => void;
}) {
  const { t, i18n } = useTranslation(["watchTogether", "swipe"]);
  const s = useThemedStyles(makeStyles);
  const lang = swipeLangOf(i18n.language);
  const deck = useAffinityDeck(state.sessionId, { onGone: onStale, onMatch });
  const [exiting, setExiting] = useState<ExitingCard[]>([]);
  const nextId = useRef(0);
  const reducedMotion = motion.isReducedMotion();
  const top = deck.cards[0];
  const { data: details } = useSwipeCardDetails(top, lang);
  const { data: nextDetails } = useSwipeCardDetails(deck.cards[1], lang);
  const { judge, undo, canUndo, saveFailed, dismissSaveFailed } = deck;

  useEffect(() => {
    if (!saveFailed) return;
    const id = setTimeout(dismissSaveFailed, 5000);
    return () => clearTimeout(id);
  }, [saveFailed, dismissSaveFailed]);

  const commit = useCallback((verdict: SwipeVerdict) => {
    if (!top || (verdict !== "like" && verdict !== "dislike")) return;
    haptic("tap");
    setExiting((list) => [...list, { id: nextId.current++, card: top, verdict, details, infoOpen: false }]);
    AccessibilityInfo.announceForAccessibility(`${t(`swipe:${verdict}`)} — ${top.title}`);
    judge(verdict);
  }, [top, details, judge, t]);

  const cards = deck.cards;
  useEffect(() => {
    setExiting((list) => {
      const kept = list.filter((e) => !cards.some((c) => c.key === e.card.key));
      return kept.length === list.length ? list : kept;
    });
  }, [cards]);
  const onUndo = useCallback(() => {
    if (!canUndo) return;
    haptic("select");
    AccessibilityInfo.announceForAccessibility(t("swipe:undone"));
    undo();
  }, [canUndo, undo, t]);
  const onExited = useCallback((id: number) => setExiting((list) => list.filter((e) => e.id !== id)), []);

  return (
    <View style={s.screen} testID="wt-affinity-deck">
      <AffinityHeaderNative state={state} room={room} selfId={selfId} onChangeKind={onChangeKind} onQuit={onQuit} />
      {deck.loading ? (
        <View style={s.center}><Skeleton width="72%" height={420} radius={26} /></View>
      ) : deck.error ? (
        <SwipeErrorNative onRetry={deck.retry} />
      ) : deck.empty ? (
        <View style={s.center} accessibilityRole="summary">
          <View style={s.emptyIcon}><PartyPopper size={24} color="#ffffff" /></View>
          <Text style={s.emptyTitle}>{t("affinityEmptyTitle")}</Text>
          <Text style={s.emptyBody}>{t("affinityEmptyBody")}</Text>
          <Pressable onPress={onChangeKind} accessibilityRole="button" style={s.other}>
            <Text style={s.otherLabel}>{t("affinityOtherKind")}</Text>
          </Pressable>
        </View>
      ) : (
        <SwipeDeckView
          cards={deck.cards} exiting={exiting} infoOpen={false} details={details} nextDetails={nextDetails}
          reducedMotion={reducedMotion} onRelease={commit} onExited={onExited} onToggleInfo={noop} binary
        />
      )}
      {saveFailed && <SwipeSaveFailedNative />}
      {!deck.error && (!deck.empty || canUndo) && (
        <SwipeControls disabled={!top} canUndo={canUndo} onJudge={commit} onUndo={onUndo} binary />
      )}
      <Text style={s.hint}>{t("affinityHint")}</Text>
    </View>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  screen: { flex: 1, gap: 8, paddingBottom: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 8 },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", backgroundColor: t.colors.brand.violet },
  emptyTitle: { marginTop: 8, color: t.colors.text.primary, fontSize: 17, fontFamily: FONT_FAMILY.semibold, textAlign: "center" },
  emptyBody: { color: t.colors.text.secondary, fontSize: 14, lineHeight: 20, fontFamily: FONT_FAMILY.regular, textAlign: "center" },
  other: { marginTop: 12, minHeight: 44, paddingHorizontal: 18, borderRadius: RADIUS.pill, justifyContent: "center", backgroundColor: t.colors.fill.soft },
  otherLabel: { color: t.colors.text.primary, fontSize: 14, fontFamily: FONT_FAMILY.semibold },
  hint: { textAlign: "center", color: t.colors.text.tertiary, fontSize: 12, fontFamily: FONT_FAMILY.regular, paddingHorizontal: 24 },
});
