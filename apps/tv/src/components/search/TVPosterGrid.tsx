import { memo, useCallback, useEffect, useRef, useState } from "react";
import { FlatList, View } from "react-native";
import type { MediaItem } from "@tentacle-tv/shared";
import { Focusable } from "../focus/Focusable";
import { TVPosterCard } from "../cards/TVPosterCard";
import { useTVNavActions } from "../../context/TVNavContext";
import { CardConfig } from "../../theme/colors";

const GAP = 24;
/** Titre et méta sous l'affiche (`TVPosterCard`). */
const META_HEIGHT = 56;

interface TVPosterGridProps {
  items: MediaItem[];
  /** Largeur utile des cartes ; la marge `gutter` s'ajoute de part et d'autre. */
  width: number;
  /** Marge DANS la liste (et non autour) : la carte focalisée grandit de 8 %,
   *  une liste bordée au ras de ses cartes la rognait sur la colonne de gauche. */
  gutter: number;
  onOpen: (item: MediaItem) => void;
  /** En-tête défilant avec la grille (portrait, titre, compte). */
  header?: React.ReactElement;
  /** La première carte prend le focus à l'arrivée (écran poussé). */
  preferFirst?: boolean;
}

/**
 * Une grille d'affiches défilante — une filmographie, un genre, un studio.
 * Colonnes déduites de la largeur (cible 180 pt) ; la rangée focalisée
 * remonte vers le haut de l'écran, la précédente encore visible.
 */
export const TVPosterGrid = memo(function TVPosterGrid({ items, width, gutter, onOpen, header, preferFirst }: TVPosterGridProps) {
  const listRef = useRef<FlatList<MediaItem>>(null);
  const columns = Math.max(3, Math.floor((width + GAP) / (180 + GAP)));
  const cardW = Math.floor((width - GAP * (columns - 1)) / columns);
  const cardH = Math.round(cardW / CardConfig.portrait.aspectRatio);
  const rowHeight = cardH + META_HEIGHT + GAP;
  const headerHeightRef = useRef(0);

  const scrollToIndex = useCallback((index: number) => {
    const row = Math.floor(index / columns);
    const offset = headerHeightRef.current + row * rowHeight - 120;
    listRef.current?.scrollToOffset({ offset: Math.max(0, offset), animated: true });
  }, [columns, rowHeight]);

  const renderItem = useCallback(({ item, index }: { item: MediaItem; index: number }) => (
    <GridCell
      item={item}
      index={index}
      cardW={cardW}
      preferred={preferFirst === true && index === 0}
      onOpen={onOpen}
      onFocusIndex={scrollToIndex}
    />
  ), [cardW, preferFirst, onOpen, scrollToIndex]);

  return (
    <FlatList
      key={columns}
      ref={listRef}
      data={items}
      numColumns={columns}
      keyExtractor={(item) => item.Id}
      renderItem={renderItem}
      ListHeaderComponent={header ? (
        <View onLayout={(e) => { headerHeightRef.current = e.nativeEvent.layout.height; }}>{header}</View>
      ) : undefined}
      columnWrapperStyle={{ gap: GAP, marginBottom: GAP }}
      contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: 16, paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
      removeClippedSubviews
      initialNumToRender={columns * 3}
      maxToRenderPerBatch={columns * 2}
      windowSize={7}
    />
  );
});

const GridCell = memo(function GridCell({ item, index, cardW, preferred, onOpen, onFocusIndex }: {
  item: MediaItem;
  index: number;
  cardW: number;
  preferred: boolean;
  onOpen: (item: MediaItem) => void;
  onFocusIndex: (index: number) => void;
}) {
  const [focused, setFocused] = useState(false);
  // Mémoire de focus du rail, comme les cartes de rangée (`FocusableRow`) : le
  // rail reste visible sur une étagère, et sa sortie doit rendre la carte
  // qu'on avait quittée. Effacée à la mort de la cellule tant qu'elle la
  // désigne — une vue détruite ne se refocalise pas.
  const cellRef = useRef<View>(null);
  const { lastContentNodeRef } = useTVNavActions();
  useEffect(
    () => () => {
      if (lastContentNodeRef.current === cellRef.current) lastContentNodeRef.current = null;
    },
    [lastContentNodeRef],
  );
  return (
    <Focusable
      ref={cellRef}
      variant="card"
      hasTVPreferredFocus={preferred}
      onPress={() => onOpen(item)}
      onFocus={() => {
        setFocused(true);
        lastContentNodeRef.current = cellRef.current;
        onFocusIndex(index);
      }}
      onBlur={() => setFocused(false)}
      accessibilityLabel={item.Name}
    >
      <TVPosterCard item={item} width={cardW} focused={focused} />
    </Focusable>
  );
});
