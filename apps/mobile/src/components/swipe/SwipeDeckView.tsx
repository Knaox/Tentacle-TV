import { useCallback, useState } from "react";
import { StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from "react-native";
import { useTranslation } from "react-i18next";
import { recoPosterUrl, swipeStackZ, useJellyfinClient } from "@tentacle-tv/api-client";
import type { SwipeCard, SwipeCardDetails, SwipeVerdict } from "@tentacle-tv/api-client";
import { SwipeCardView } from "./SwipeCardView";

/** Cartes montées : celle du dessus et deux en attente (affiches chargées d'avance). */
const VISIBLE = 3;

/** Une carte jugée qui finit son mouvement — avec SON verso et l'état de
 *  son synopsis au moment du verdict : rien ne change sur elle en partant. */
export interface ExitingCard {
  id: number;
  card: SwipeCard;
  verdict: SwipeVerdict;
  details: SwipeCardDetails | undefined;
  infoOpen: boolean;
}

interface Props {
  cards: SwipeCard[];
  exiting: ExitingCard[];
  infoOpen: boolean;
  /** Verso de la carte du dessus. */
  details: SwipeCardDetails | undefined;
  /** Verso de la suivante : elle monte en tête déjà habillée (titre, durée). */
  nextDetails: SwipeCardDetails | undefined;
  reducedMotion: boolean;
  onRelease: (verdict: SwipeVerdict) => void;
  onExited: (id: number) => void;
  onToggleInfo: () => void;
}

/**
 * La pile : la plus grande carte 2:3 qui tient dans la place laissée par
 * l'en-tête et les boutons (mesurée), les cartes en attente derrière, et les
 * cartes qui finissent de partir. Toutes dans UNE liste, les partantes
 * d'abord : une carte jugée garde sa vue (même clé, même place) — son affiche
 * et son tampon partent avec elle — et l'empilement suit l'ordre d'arrivée
 * (`swipeStackZ`), la carte jugée restant dessus jusqu'au bout.
 */
export function SwipeDeckView({
  cards, exiting, infoOpen, details, nextDetails, reducedMotion, onRelease, onExited, onToggleInfo,
}: Props) {
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
  const onAction = (name: string) => onRelease(name as SwipeVerdict);

  const visible = cards.slice(0, VISIBLE);
  // Une carte rendue par « annuler » en pleine sortie reprend sa place dans la pile.
  const leaving = exiting.filter((e) => !visible.some((c) => c.key === e.card.key));
  const rows = [
    ...leaving.map((e) => ({ card: e.card, depth: 0, exit: e, info: e.infoOpen, face: e.details })),
    ...visible.map((card, depth) => ({
      card,
      depth,
      exit: undefined,
      info: depth === 0 && infoOpen,
      face: depth === 0 ? details : depth === 1 ? nextDetails : undefined,
    })),
  ];

  return (
    <View style={st.area} onLayout={onLayout}>
      {cardW > 0 && (
        <View style={{ width: cardW, height: cardW * 1.5 }}>
          {rows.map(({ card, depth, exit, info, face }) => (
            <SwipeCardView
              key={card.key}
              card={card}
              depth={depth}
              zIndex={swipeStackZ(card)}
              posterUri={posterOf(card)}
              infoOpen={info}
              details={face}
              reducedMotion={reducedMotion}
              label={card.year ? t("cardLabel", { title: card.title, year: card.year }) : card.title}
              screenWidth={screenWidth}
              exit={exit ? { id: exit.id, verdict: exit.verdict } : undefined}
              onRelease={onRelease}
              onExited={onExited}
              onToggleInfo={onToggleInfo}
              accessibilityActions={actions}
              onAccessibilityAction={onAction}
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
