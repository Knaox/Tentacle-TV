import { memo, useCallback, type ReactElement } from "react";
import { FlatList, StyleSheet, View, type ListRenderItemInfo } from "react-native";
import { TV_STAGE } from "@tentacle-tv/theme";
import { MediaCard } from "../../cards/MediaCard";
import type { CardModel } from "../../cards/cardTypes";

/**
 * La grille d'affiches des pages de catalogue — bibliothèque, Ma liste,
 * Favoris, Parcourir : de grandes affiches 2:3, cinq ou six par ligne, leur
 * légende dessous. Au focus, l'affiche grandit depuis son centre (la légende
 * ne bouge pas) ; rien au centre de l'image.
 *
 * L'en-tête de la page vit DANS la liste (`header`) et reste monté quand la
 * grille se vide : filtrer à zéro ne démonte pas la pastille qu'on vient
 * d'actionner. Chargement et vide passent par `empty`, à la place des
 * cellules. La clé de focus d'une affiche est `${focusPrefix}:${index}`.
 */

export interface PosterGridProps {
  cards: CardModel[];
  columns?: 5 | 6;
  header?: ReactElement | null;
  /** Rendu à la place des cellules quand `cards` est vide (squelette, vide). */
  empty?: ReactElement | null;
  footer?: ReactElement | null;
  focusPrefix?: string;
  onPressCard?: (card: CardModel) => void;
  onLongPressCard?: (card: CardModel) => void;
  onFocusCard?: (card: CardModel) => void;
  /** La fin approche : la page suivante du catalogue. */
  onEndReached?: () => void;
}

/** La colonne de contenu : après la navigation repliée, jusqu'à la marge sûre. */
export const GRID_WIDTH = 1920 - TV_STAGE.contentLeft - TV_STAGE.safe.x;
export const GRID_GAP = 36;
export const GRID_ROW_GAP = 40;

/** La largeur d'une affiche pour `columns` colonnes. */
export function posterWidth(columns: number): number {
  return Math.floor((GRID_WIDTH - GRID_GAP * (columns - 1)) / columns);
}

interface CellProps {
  card: CardModel;
  index: number;
  width: number;
  focusPrefix: string;
  onPressCard?: (card: CardModel) => void;
  onLongPressCard?: (card: CardModel) => void;
  onFocusCard?: (card: CardModel) => void;
}

const Cell = memo(function Cell({ card, index, width, focusPrefix, onPressCard, onLongPressCard, onFocusCard }: CellProps) {
  const onPress = useCallback(() => onPressCard?.(card), [card, onPressCard]);
  const onLongPress = useCallback(() => onLongPressCard?.(card), [card, onLongPressCard]);
  const onFocusChange = useCallback((focused: boolean) => focused && onFocusCard?.(card), [card, onFocusCard]);
  return (
    <MediaCard
      card={card}
      variant="poster"
      width={width}
      origin="center"
      focusKey={`${focusPrefix}:${index}`}
      onPress={onPressCard ? onPress : undefined}
      onLongPress={onLongPressCard ? onLongPress : undefined}
      onFocusChange={onFocusChange}
    />
  );
});

const Separator = () => <View style={styles.separator} />;

export const PosterGrid = memo(function PosterGrid({
  cards,
  columns = 6,
  header,
  empty,
  footer,
  focusPrefix = "grid",
  onPressCard,
  onLongPressCard,
  onFocusCard,
  onEndReached,
}: PosterGridProps) {
  const width = posterWidth(columns);
  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<CardModel>) => (
      <Cell
        card={item}
        index={index}
        width={width}
        focusPrefix={focusPrefix}
        onPressCard={onPressCard}
        onLongPressCard={onLongPressCard}
        onFocusCard={onFocusCard}
      />
    ),
    [width, focusPrefix, onPressCard, onLongPressCard, onFocusCard],
  );
  return (
    <FlatList
      // Le nombre de colonnes ne change pas à chaud : une clé neuve remonte la liste.
      key={`grid-${columns}`}
      data={cards}
      numColumns={columns}
      keyExtractor={(card) => card.id}
      renderItem={renderItem}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      ListFooterComponent={footer}
      ItemSeparatorComponent={Separator}
      columnWrapperStyle={styles.columns}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.6}
      initialNumToRender={4}
      style={styles.list}
    />
  );
});

/** La hauteur de la scène. Sur TV, la liste virtualisée enveloppe son
 *  défilement dans un `TVFocusGuideView` SANS style (hauteur automatique) :
 *  un `flex: 1` y écrase la grille à 1 point. Une hauteur explicite, oui. */
const STAGE_HEIGHT = 1080;

const styles = StyleSheet.create({
  list: { height: STAGE_HEIGHT },
  content: {
    paddingLeft: TV_STAGE.contentLeft,
    paddingRight: TV_STAGE.safe.x,
    paddingTop: TV_STAGE.safe.y,
    paddingBottom: 160,
  },
  columns: { gap: GRID_GAP },
  separator: { height: GRID_ROW_GAP },
});
