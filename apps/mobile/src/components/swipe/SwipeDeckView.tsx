import { useCallback, useState } from "react";
import { StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from "react-native";
import { useTranslation } from "react-i18next";
import { recoPosterUrl, useJellyfinClient } from "@tentacle-tv/api-client";
import type { SwipeCard, SwipeCardDetails, SwipeVerdict } from "@tentacle-tv/api-client";
import { SwipeCardView } from "./SwipeCardView";
import { SwipeExitingCard } from "./SwipeExitingCard";

/** Cartes montées : celle du dessus et deux en attente (affiches chargées d'avance). */
const VISIBLE = 3;

export interface ExitingCard {
  id: number;
  card: SwipeCard;
  verdict: SwipeVerdict;
  from: { x: number; y: number };
}

interface Props {
  cards: SwipeCard[];
  exiting: ExitingCard[];
  infoOpen: boolean;
  details: SwipeCardDetails | undefined;
  reducedMotion: boolean;
  onRelease: (verdict: SwipeVerdict, from: { x: number; y: number }) => void;
  onExited: (id: number) => void;
  onToggleInfo: () => void;
}

/**
 * La pile : la plus grande carte 2:3 qui tient dans la place laissée par
 * l'en-tête et les boutons (mesurée), les cartes en attente derrière, et
 * par-dessus, les cartes qui finissent de partir.
 */
export function SwipeDeckView({ cards, exiting, infoOpen, details, reducedMotion, onRelease, onExited, onToggleInfo }: Props) {
  const { t } = useTranslation("swipe");
  const client = useJellyfinClient();
  const { width: screenWidth } = useWindowDimensions();
  const [box, setBox] = useState({ w: 0, h: 0 });
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox({ w: width, h: height });
  }, []);
  // 24 pt de marge pour les cartes en attente, qui dépassent en bas.
  const cardW = Math.max(0, Math.min(box.w, (box.h - 24) * (2 / 3), 420));
  const posterOf = (card: SwipeCard) =>
    recoPosterUrl(card, (id) => client.getImageUrl(id, "Primary", { width: 700, quality: 85 }), "w500");

  // VoiceOver : balayer vers le haut / le bas choisit le verdict ; le double
  // toucher (onPress) retourne la carte.
  const actions = [
    { name: "like", label: t("like") },
    { name: "superlike", label: t("superlike") },
    { name: "dislike", label: t("dislike") },
    { name: "skip", label: t("skip") },
  ];
  const onAction = (name: string) => onRelease(name as SwipeVerdict, { x: 0, y: 0 });

  return (
    <View style={st.area} onLayout={onLayout}>
      {cardW > 0 && (
        <View style={{ width: cardW, height: cardW * 1.5 }}>
          {cards.slice(0, VISIBLE).map((card, depth) => (
            <SwipeCardView
              key={card.key}
              card={card}
              depth={depth}
              posterUri={posterOf(card)}
              infoOpen={depth === 0 && infoOpen}
              details={depth === 0 ? details : undefined}
              reducedMotion={reducedMotion}
              label={card.year ? t("cardLabel", { title: card.title, year: card.year }) : card.title}
              onRelease={onRelease}
              onToggleInfo={onToggleInfo}
              accessibilityActions={actions}
              onAccessibilityAction={onAction}
            />
          )).reverse()}
          {exiting.map((e) => (
            <SwipeExitingCard
              key={e.id}
              card={e.card}
              verdict={e.verdict}
              from={e.from}
              posterUri={posterOf(e.card)}
              screenWidth={screenWidth}
              reducedMotion={reducedMotion}
              onDone={() => onExited(e.id)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  area: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 12 },
});
