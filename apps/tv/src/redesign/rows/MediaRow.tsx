import { memo, useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { TV_STAGE } from "@tentacle-tv/theme";
import { MediaCard } from "../cards/MediaCard";
import type { CardModel } from "../cards/cardTypes";
import { useForcedFocusKey } from "../focus/focusPreview";
import { text } from "../theme/tokens";

/**
 * Une rangée : son titre (36 pt), puis ses cartes à l'horizontale, peu
 * nombreuses et grandes. Quand une carte a le focus, ses voisines reculent
 * un peu. La clé de focus d'une carte est `${rowKey}:${index}`.
 */

export interface MediaRowProps {
  rowKey: string;
  title: string;
  cards: CardModel[];
  variant: "landscape" | "poster";
  cardWidth?: number;
  /** Retrait gauche du titre et de la première carte (la colonne de contenu). */
  inset: number;
  accessory?: React.ReactNode;
  onPressCard?: (card: CardModel) => void;
  onLongPressCard?: (card: CardModel) => void;
  onFocusCard?: (card: CardModel) => void;
}

export const MediaRow = memo(function MediaRow({
  rowKey,
  title,
  cards,
  variant,
  cardWidth,
  inset,
  accessory,
  onPressCard,
  onLongPressCard,
  onFocusCard,
}: MediaRowProps) {
  const [nativeIndex, setNativeIndex] = useState<number | null>(null);
  const forced = useForcedFocusKey();
  const forcedIndex = forced?.startsWith(`${rowKey}:`) ? Number(forced.slice(rowKey.length + 1)) : null;
  const focusedIndex = forced !== null ? forcedIndex : nativeIndex;

  const onFocusChange = useCallback(
    (index: number, focused: boolean) => {
      setNativeIndex((current) => (focused ? index : current === index ? null : current));
      if (focused) onFocusCard?.(cards[index]);
    },
    [cards, onFocusCard],
  );

  if (cards.length === 0) return null;
  return (
    <View style={styles.row}>
      <View style={[styles.header, { paddingLeft: inset }]}>
        <Text style={text.rowTitle} numberOfLines={1}>{title}</Text>
        {accessory}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.track}
        contentContainerStyle={[styles.content, { paddingLeft: inset, paddingRight: TV_STAGE.safe.x }]}
      >
        {cards.map((card, index) => (
          <MediaCard
            key={card.id}
            card={card}
            variant={variant}
            width={cardWidth}
            focusKey={`${rowKey}:${index}`}
            dimmed={focusedIndex !== null && focusedIndex !== index}
            onPress={onPressCard ? () => onPressCard(card) : undefined}
            onLongPress={onLongPressCard ? () => onLongPressCard(card) : undefined}
            onFocusChange={(focused) => onFocusChange(index, focused)}
          />
        ))}
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  row: { marginBottom: TV_STAGE.row.spacing - 24 },
  header: { flexDirection: "row", alignItems: "center", gap: 18, marginBottom: TV_STAGE.row.titleGap - 8 },
  // Le débord laisse la place à l'agrandissement et à l'ombre des cartes.
  track: { overflow: "visible" },
  content: { gap: TV_STAGE.row.gap, paddingTop: 12, paddingBottom: 24 },
});
