import { memo, useCallback, useEffect, useRef, useState } from "react";
import { View, ActivityIndicator, findNodeHandle, useWindowDimensions } from "react-native";
import { FlashList } from "@shopify/flash-list";
import type { MediaItem } from "@tentacle-tv/shared";
import { TV_OVERSCAN_PT } from "@tentacle-tv/theme";
import { TVPosterFrame, TVPosterMeta } from "../cards/TVPosterCard";
import { Focusable } from "../focus/Focusable";
import { RAIL_COLLAPSED } from "../nav/TVSideRail";
import { Colors, Spacing, CardConfig } from "../../theme/colors";

/** Largeur minimale d'une carte et écart — la formule de colonnes de la LG
 *  (`columnsTv.ts` : `max(2, ⌊(largeur + 16) / 196⌋)`). */
const MIN_CARD = 180;
const GAP = 16;
const ROW_GAP = 24;

/** La géométrie de grille, dérivée de la largeur réellement disponible
 *  (réactive). Partagée entre la grille et les squelettes de chargement. */
export function useTVGridLayout() {
  const { width: windowW } = useWindowDimensions();
  const availW = windowW - RAIL_COLLAPSED - TV_OVERSCAN_PT.x - Spacing.rowGutter * 2;
  const columns = Math.max(2, Math.floor((availW + GAP) / (MIN_CARD + GAP)));
  const cellW = Math.floor(availW / columns);
  const cardW = cellW - GAP;
  const cardH = Math.round(cardW / CardConfig.portrait.aspectRatio);
  // Image 2:3 + titre + année + marges
  const estimatedItemSize = cardH + 56 + ROW_GAP;
  return { columns, cellW, cardW, cardH, estimatedItemSize };
}

interface TVLibraryGridProps {
  /** Identité de la liste : changer de bibliothèque remonte la FlashList
   *  (offset et focus repartent à zéro). Le nombre de colonnes s'y ajoute :
   *  FlashList ne relayoute pas proprement un changement de `numColumns`. */
  listKey: string;
  items: MediaItem[];
  header?: React.ReactElement | null;
  onPressItem: (item: MediaItem) => void;
  /** Publié au focus d'une carte — alimente le fond ambient plein écran. */
  onItemFocus?: (item: MediaItem) => void;
  onEndReached?: () => void;
  isFetchingNextPage?: boolean;
  /** Publie la 1ʳᵉ cellule comme focusable d'entrée du contenu (sortie rail +
   *  auto-collapse — useTVContentEntry côté écran). */
  entryRef?: (node: View | null) => void;
  /** Ce qu'on montre à la place des cellules quand il n'y en a aucune.
   *
   *  Rendu PAR la liste, et non à sa place : c'est ce qui garde l'en-tête —
   *  donc la barre de filtres — monté d'un état à l'autre. Rendre l'état vide
   *  en dehors de la liste démontait tout l'arbre, y compris la puce que
   *  l'utilisateur venait d'actionner, et le focus partait se perdre. */
  emptyComponent?: React.ReactElement | null;
}

/**
 * La grille d'affiches — bibliothèque, Ma liste, Favoris. Extraite de
 * `LibraryScreen` : les trois écrans partagent la même géométrie (formule de
 * colonnes webOS), le même suivi de focus et la même pagination.
 */
export function TVLibraryGrid({
  listKey,
  items,
  header,
  onPressItem,
  onItemFocus,
  onEndReached,
  isFetchingNextPage,
  entryRef,
  emptyComponent,
}: TVLibraryGridProps) {
  const { columns, cellW, cardW, estimatedItemSize } = useTVGridLayout();
  const flashListRef = useRef<FlashList<MediaItem>>(null);

  // Guard: only scroll when the focused row actually changes (prevents
  // rollback on DPAD left/right)
  const lastScrolledRow = useRef(-1);
  const scrollToRow = useCallback((rowIndex: number) => {
    if (lastScrolledRow.current === rowIndex) return;
    lastScrolledRow.current = rowIndex;
    if (rowIndex === 0) {
      // 1ʳᵉ rangée : remonter à l'offset 0 pour garder l'en-tête visible —
      // scrollToIndex(0, viewPosition 0.3) le coupait.
      flashListRef.current?.scrollToOffset({ offset: 0, animated: false });
      return;
    }
    flashListRef.current?.scrollToIndex({ index: rowIndex * columns, animated: false, viewPosition: 0.3 });
  }, [columns]);

  // totalItems via ref : chaque page chargée ne doit pas invalider renderItem
  // (sinon toute la grille re-rend à chaque pagination).
  const totalItemsRef = useRef(0);
  totalItemsRef.current = items.length;
  const isLastItem = useCallback((index: number) => index === totalItemsRef.current - 1, []);

  const renderItem = useCallback(({ item, index }: { item: MediaItem; index: number }) => (
    <GridItem
      item={item}
      index={index}
      columns={columns}
      cellW={cellW}
      cardW={cardW}
      isLastItem={isLastItem(index)}
      onPressItem={onPressItem}
      onItemFocus={onItemFocus}
      onFocusRow={scrollToRow}
      entryRef={entryRef}
    />
  ), [columns, cellW, cardW, onPressItem, onItemFocus, scrollToRow, isLastItem, entryRef]);

  return (
    <FlashList
      // Remonter la liste à CHAQUE changement de bibliothèque : sans `key`,
      // FlashList est réutilisée et conserve son contentOffset interne (offset
      // résiduel = page « légèrement défilée »). Un conteneur neuf repart à 0.
      // Le tri/les filtres ne changent PAS la key → pas de remontage → pas de
      // vol de focus sur les commandes.
      key={`${listKey}-${columns}`}
      ref={flashListRef}
      data={items}
      numColumns={columns}
      estimatedItemSize={estimatedItemSize}
      renderItem={renderItem}
      keyExtractor={(item) => item.Id}
      ListHeaderComponent={header}
      ListEmptyComponent={emptyComponent}
      contentContainerStyle={{ paddingHorizontal: Spacing.rowGutter, paddingBottom: 80 }}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      drawDistance={800}
      overrideItemLayout={(layout) => { layout.size = estimatedItemSize; }}
      ListFooterComponent={isFetchingNextPage ? <FooterLoader /> : null}
      overScrollMode="never"
    />
  );
}

function FooterLoader() {
  return (
    <View style={{ paddingVertical: 24, alignItems: "center" }}>
      <ActivityIndicator size="small" color={Colors.accentPurple} />
    </View>
  );
}

/* ---- Grid item with edge focus clamping ---- */

// Mémoïsé : la grille FlashList re-rend au scroll/focus — seules les props
// stables (callbacks par référence) évitent un re-render O(n) de la grille.
const GridItem = memo(function GridItem({ item, index, columns, cellW, cardW, isLastItem, onPressItem, onItemFocus, onFocusRow, entryRef }: {
  item: MediaItem; index: number; columns: number; cellW: number; cardW: number; isLastItem: boolean;
  onPressItem: (item: MediaItem) => void; onItemFocus?: (item: MediaItem) => void; onFocusRow: (rowIndex: number) => void;
  entryRef?: (node: View | null) => void;
}) {
  const ref = useRef<View | null>(null);
  const [nodeId, setNodeId] = useState<number | undefined>(undefined);
  const [focused, setFocused] = useState(false);

  // Ref combinée : la ref interne (nextFocusRight) + la publication d'entrée
  // de contenu quand cette cellule est la première de la grille.
  const attachRefs = useCallback((node: View | null) => {
    ref.current = node;
    if (index === 0) entryRef?.(node);
  }, [index, entryRef]);

  useEffect(() => {
    const handle = findNodeHandle(ref.current);
    if (handle) setNodeId(handle);
  }, []);

  const isLastInRow = index % columns === columns - 1 || isLastItem;

  return (
    <View style={{ width: cellW, marginBottom: ROW_GAP }}>
      {/* Le ring de focus n'entoure QUE l'affiche (comme le web) — les textes
          restent dessous, hors halo, sans déborder sur la rangée suivante. */}
      <Focusable
        ref={attachRefs}
        variant="card"
        onPress={() => onPressItem(item)}
        onFocus={() => { setFocused(true); onItemFocus?.(item); onFocusRow(Math.floor(index / columns)); }}
        onBlur={() => setFocused(false)}
        // JAMAIS de hasTVPreferredFocus sur une cellule de FlashList recyclée :
        // chaque refiltre/recyclage qui replace une instance à l'index 0
        // rappelait le focus natif — la grille VOLAIT le focus des puces de
        // filtre (react-native-tvos #839/#552/#849). L'entrée de focus passe
        // par `entryRef` (useTVContentEntry) et le guide de l'écran.
        focusRadius={8}
        nextFocusRight={isLastInRow ? nodeId : undefined}
        style={{ alignSelf: "flex-start" }}
      >
        <TVPosterFrame item={item} width={cardW} focused={focused} />
      </Focusable>
      <TVPosterMeta item={item} width={cardW} />
    </View>
  );
});
