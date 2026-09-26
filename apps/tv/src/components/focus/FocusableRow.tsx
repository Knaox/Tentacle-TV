import { useEffect, useRef, useState, useCallback } from "react";
import type { ReactNode } from "react";
import { FlatList, View, Text, type ViewStyle, type LayoutChangeEvent } from "react-native";
import { Focusable } from "./Focusable";
import { useTVRemote } from "./useTVRemote";
import { RowEntryGuide, useRowEntry } from "./RowEntryGuide";
import { useTVNavActions } from "../../context/TVNavContext";
import { Colors, Spacing, Typography } from "../../theme/colors";
import { CARD_FOCUS_BLEED } from "../../theme/focus";

/** Débordement vertical laissé à l'anneau, au halo et à l'ombre de la carte
 *  focalisée (`CARD_FOCUS_BLEED`). La fenêtre de rognage est plus haute
 *  d'autant EN HAUT ET EN BAS, et décalée de la même valeur : la mise en page
 *  ne bouge pas d'un point. */
const ROW_CLIP_BLEED = CARD_FOCUS_BLEED;

interface FocusableRowProps<T> {
  title?: string;
  /** Juste après le titre, toujours visible (la pastille du filtre de
   *  plateformes, focalisable) — sans lui, le titre reste un texte nu. */
  titleAccessory?: ReactNode;
  data: T[];
  /** `focused` permet de révéler la méta qualité au focus (hover web). */
  renderItem: (item: T, index: number, focused: boolean) => React.ReactNode;
  keyExtractor: (item: T) => string;
  itemWidth: number;
  gap?: number;
  style?: ViewStyle;
  onItemPress?: (item: T) => void;
  /** Called when user navigates left past the first item */
  onEdgeLeft?: () => void;
  /** Called when any item in this row receives focus */
  onRowFocus?: () => void;
  /** Called when an individual item gains focus — used by ambient backdrop */
  onItemFocus?: (item: T, index: number) => void;
  /** Layout callback for tracking row Y position */
  onLayout?: (event: LayoutChangeEvent) => void;
  onItemLongPress?: (item: T) => void;
  /** HAUT depuis une cellule → ce focusable (handle natif). Sert quand la cible
   *  géométrique naturelle est hors écran (page défilée) : sans lui, le moteur
   *  ne trouve rien et le focus reste bloqué dans la rangée. */
  cellNextFocusUp?: number;
  /** La première carte, montée ou démontée — la cible d'une validation de
   *  recherche quand la rangée ouvre les résultats (`useSearchSubmit`). */
  onFirstItem?: (node: View | null) => void;
}

export function FocusableRow<T>({
  title,
  titleAccessory,
  data,
  renderItem,
  keyExtractor,
  itemWidth,
  gap = Spacing.cardGap,
  style,
  onItemPress,
  onEdgeLeft,
  onRowFocus,
  onItemFocus,
  onLayout,
  onItemLongPress,
  cellNextFocusUp,
  onFirstItem,
}: FocusableRowProps<T>) {
  const listRef = useRef<FlatList>(null);
  const focusedIndexRef = useRef(-1);
  const rowHasFocusRef = useRef(false);

  const scrollToIndex = useCallback(
    (index: number) => {
      listRef.current?.scrollToIndex({
        index,
        animated: true,
        viewOffset: Spacing.rowGutter,
      });
    },
    []
  );

  // L'entrée par la première carte visible — cf. `RowEntryGuide`.
  const entry = useRowEntry({ itemWidth, gap, count: data.length });
  const firstItem = useRef(onFirstItem);
  firstItem.current = onFirstItem;
  const publishNode = entry.onNode;
  const onNode = useCallback((index: number, node: View | null) => {
    publishNode(index, node);
    if (index === 0) firstItem.current?.(node);
  }, [publishNode]);

  // When the first item has focus and user presses left, fire onEdgeLeft
  useTVRemote({
    onLeft: onEdgeLeft
      ? () => {
          if (rowHasFocusRef.current && focusedIndexRef.current === 0) {
            onEdgeLeft();
          }
        }
      : undefined,
  });

  if (data.length === 0) return null;

  return (
    <View style={style} onLayout={onLayout}>
      {title && !titleAccessory && (
        <Text style={{
          color: Colors.textPrimary,
          ...Typography.sectionTitle,
          // `mb-1` web : la piste porte déjà 32 pt de réserve haute.
          marginBottom: 4,
          paddingHorizontal: Spacing.rowGutter,
        }}>
          {title}
        </Text>
      )}
      {title && titleAccessory && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4, paddingHorizontal: Spacing.rowGutter }}>
          <Text style={{ color: Colors.textPrimary, ...Typography.sectionTitle, flexShrink: 1 }} numberOfLines={1}>
            {title}
          </Text>
          {titleAccessory}
        </View>
      )}
      {/* La piste est ROGNÉE à la colonne de contenu. Sans cela, les cartes
          défilées à gauche restaient peintes sous le rail — qui n'a qu'un voile —
          et le menu devenait illisible (`overflow: visible` sur la liste, dans un
          ScrollView élargi à tout l'écran pour le halo de la bannière). Le rognage
          est horizontal en pratique : la fenêtre déborde de ROW_CLIP_BLEED en haut
          et en bas, là où l'anneau et l'ombre de la carte focalisée passent. */}
      <View style={{ overflow: "hidden", marginVertical: -ROW_CLIP_BLEED, paddingVertical: ROW_CLIP_BLEED }}>
      <RowEntryGuide ref={entry.guideRef}>
      <FlatList
        ref={listRef}
        data={data}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ overflow: "visible" }}
        // `pt-8 / pb-6` web : la réserve haute absorbe l'anneau et le scale
        // 1.08 (origine bas) de la carte focusée, sans rognage ni chevauchement.
        contentContainerStyle={{ paddingHorizontal: Spacing.rowGutter, paddingTop: 32, paddingBottom: 24 }}
        keyExtractor={keyExtractor}
        onScroll={entry.onScroll}
        scrollEventThrottle={32}
        initialNumToRender={6}
        windowSize={21}
        maxToRenderPerBatch={10}
        getItemLayout={(_, index) => ({
          length: itemWidth + gap,
          offset: (itemWidth + gap) * index,
          index,
        })}
        renderItem={({ item, index }) => (
          <RowCell
            item={item}
            index={index}
            itemWidth={itemWidth}
            gap={gap}
            renderItem={renderItem}
            onCellFocus={() => {
              focusedIndexRef.current = index;
              rowHasFocusRef.current = true;
              scrollToIndex(index);
              onRowFocus?.();
              onItemFocus?.(item, index);
            }}
            onCellBlur={() => {
              if (focusedIndexRef.current === index) rowHasFocusRef.current = false;
            }}
            onPress={onItemPress ? () => onItemPress(item) : undefined}
            onLongPress={onItemLongPress ? () => onItemLongPress(item) : undefined}
            nextFocusUp={cellNextFocusUp}
            onNode={onNode}
          />
        )}
      />
      </RowEntryGuide>
      </View>
    </View>
  );
}

/** Cellule à état de focus local — seule la cellule re-render au focus. */
function RowCell<T>({ item, index, itemWidth, gap, renderItem, onCellFocus, onCellBlur, onPress, onLongPress, nextFocusUp, onNode }: {
  item: T; index: number; itemWidth: number; gap: number;
  renderItem: (item: T, index: number, focused: boolean) => React.ReactNode;
  onCellFocus: () => void; onCellBlur: () => void;
  onPress?: () => void; onLongPress?: () => void;
  nextFocusUp?: number;
  /** Publie la carte montée à son index — l'annuaire du guide d'entrée. */
  onNode: (index: number, node: View | null) => void;
}) {
  const [focused, setFocused] = useState(false);
  const cellRef = useRef<View>(null);
  const { lastContentNodeRef } = useTVNavActions();

  useEffect(() => {
    onNode(index, cellRef.current);
    return () => onNode(index, null);
  }, [index, onNode]);

  /**
   * La cellule EFFACE la mémoire de focus en mourant, tant qu'elle la désigne.
   *
   * Sans cela, `lastContentNodeRef` survit à la vue qu'il nomme : la liste
   * recycle ses cellules dès que les données changent — et revenir d'une fiche
   * invalide justement « Reprendre », « Prochains épisodes » et « Ma liste »
   * (`HomeScreen`). La restauration de focus tire alors, soixante millisecondes
   * plus tard, un `setNativeProps` sur une vue détruite, et React Native lève
   * « Trying to update non-existent view with tag N ».
   *
   * Le garde compare à la vue de CETTE cellule : une autre a pu publier la
   * sienne entre-temps, et ce n'est pas à celle qui part de l'effacer.
   *
   * **La vue est relevée au montage, jamais relue au démontage.** Quand React
   * joue ce nettoyage, il a déjà détaché les références de l'arbre qui s'en
   * va : `cellRef.current` y vaut `null`, la comparaison échouait à coup sûr
   * et la mémoire survivait à chaque carte démontée. Retour depuis une carte
   * de la recherche : l'accueil rendait le focus à la carte morte.
   */
  useEffect(() => {
    const node = cellRef.current;
    return () => {
      if (lastContentNodeRef.current === node) lastContentNodeRef.current = null;
    };
  }, [lastContentNodeRef]);
  return (
    <View style={{ width: itemWidth, marginRight: gap, overflow: "visible" }}>
      <Focusable
        ref={cellRef}
        variant="card"
        onFocus={() => {
          setFocused(true);
          // Mémoire de focus : dernier élément de contenu focalisé → restaure le
          // focus en sortant de la sidebar (tvOS) et au retour d'un écran empilé
          // (détail/lecteur) — sur Android, sans elle le moteur natif rendait le
          // focus à la sidebar à chaque retour sur l'accueil.
          lastContentNodeRef.current = cellRef.current;
          onCellFocus();
        }}
        onBlur={() => { setFocused(false); onCellBlur(); }}
        onPress={onPress}
        onLongPress={onLongPress}
        nextFocusUp={nextFocusUp}
        focusRadius={8}
      >
        {renderItem(item, index, focused)}
      </Focusable>
    </View>
  );
}
