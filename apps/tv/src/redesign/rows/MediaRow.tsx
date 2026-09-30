import { memo, useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { TV_STAGE } from "@tentacle-tv/theme";
import { cardIndexOf } from "../cards/cardFocusKeys";
import { MediaCard } from "../cards/MediaCard";
import { MORPH_OVERFLOW, MorphCard } from "../cards/MorphCard";
import type { CardModel } from "../cards/cardTypes";
import { useForcedFocusKey } from "../focus/focusPreview";
import { text } from "../theme/tokens";

/**
 * Une rangée : son titre (36 pt), puis ses cartes à l'horizontale, peu
 * nombreuses et grandes. Quand une carte a le focus, ses voisines reculent
 * un peu. La clé de focus d'une carte est `${rowKey}:${index}` ; son plateau,
 * quand elle en a un, vit sous `${rowKey}:${index}:tray` (`cards/tray/CardTray`).
 */

export interface MediaRowProps {
  rowKey: string;
  title: string;
  cards: CardModel[];
  /** `morph` : 16:9 au repos, affiche 2:3 au focus (`MorphCard`). */
  variant: "landscape" | "poster" | "morph";
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
  // La carte, ou un bouton de son plateau (`${rowKey}:${index}:tray:…`).
  const focusedIndex = forced !== null ? cardIndexOf(forced, rowKey) : nativeIndex;

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
        contentContainerStyle={[
          styles.content,
          { paddingLeft: inset, paddingRight: TV_STAGE.safe.x },
          variant === "morph" && styles.morphContent,
        ]}
      >
        {cards.map((card, index) => {
          const common = {
            card,
            focusKey: `${rowKey}:${index}`,
            dimmed: focusedIndex !== null && focusedIndex !== index,
            onPress: onPressCard ? () => onPressCard(card) : undefined,
            onLongPress: onLongPressCard ? () => onLongPressCard(card) : undefined,
            onFocusChange: (focused: boolean) => onFocusChange(index, focused),
          };
          return variant === "morph" ? (
            <MorphCard key={card.id} {...common} />
          ) : (
            <MediaCard key={card.id} {...common} variant={variant} width={cardWidth} />
          );
        })}
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
  // La place que l'affiche d'une carte qui se redresse prend au-dessus.
  morphContent: { paddingTop: MORPH_OVERFLOW, marginTop: -MORPH_OVERFLOW + 12 },
});
