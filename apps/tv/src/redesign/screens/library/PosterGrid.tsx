import { memo, useCallback, useMemo, useRef, type ReactElement } from "react";
import { StyleSheet, View } from "react-native";
import { FlashList, type ListRenderItemInfo } from "@shopify/flash-list";
import { TV_STAGE } from "@tentacle-tv/theme";
import { GRID_END_REACHED_SCREENS, GRID_KEY_PREFIX, gridLineReveal } from "@tentacle-tv/tv-core";
import { MediaCard } from "../../cards/MediaCard";
import type { CardModel } from "../../cards/cardTypes";
import { FocusSection, type FocusSectionReveal } from "../../focus/FocusSection";

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
 *
 * Chaque LIGNE est une section (`FocusSection`, clé
 * `${focusPrefix}:line:<n>`) : BAS depuis une colonne que la dernière ligne
 * n'a pas atteint sa dernière affiche, au plus proche ; la ligne focalisée
 * vient entière à l'écran, « Maintenir OK » compris, en un seul mouvement —
 * la première, elle, ramène la page tout en haut (titre et filtres).
 *
 * Les lignes sont RECYCLÉES (FlashList) : une ligne qui sort de l'écran sert
 * à celle qui arrive, ses cartes reçoivent un autre titre au lieu d'être
 * démontées et remontées — dans une bibliothèque de mille titres, défiler ne
 * crée plus ni vue native ni valeur animée. Les cartes d'une ligne sont donc
 * clées par leur PLACE, et une carte qui change de titre change d'image sans
 * jamais montrer la précédente (`MediaCard`).
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
/** Entre deux rangées : la place de « Maintenir OK : plus d'options » sous la
 *  légende de l'affiche focalisée, qui descend de la moitié de son
 *  agrandissement (~15) — sans quoi la rangée suivante mord la ligne. */
export const GRID_ROW_GAP = 52;

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

/** Comment la page montre une ligne (`gridLineReveal`, tv-core) : la PREMIÈRE
 *  ramène la page tout en haut, son titre et ses filtres avec elle ; les
 *  autres viennent entières à l'écran, au plus près (56 des bords, la place
 *  de « Maintenir OK » sous la légende). Des objets stables : la section est
 *  mémoïsée. */
const LINE_REVEALS: Record<"start" | "nearest", FocusSectionReveal> = { start: { mode: "start" }, nearest: { mode: "nearest" } };

interface Line {
  start: number;
  cards: CardModel[];
}

/** Les cartes par lignes de `columns`. Une ligne inchangée garde son tableau
 *  (une page de plus ne redessine que la dernière ligne). */
function useLines(cards: CardModel[], columns: number): Line[] {
  const previous = useRef<Line[]>([]);
  return useMemo(() => {
    const lines: Line[] = [];
    for (let start = 0; start < cards.length; start += columns) {
      const slice = cards.slice(start, start + columns);
      const old = previous.current[lines.length];
      const same = old && old.start === start && old.cards.length === slice.length && old.cards.every((card, i) => card === slice[i]);
      lines.push(same ? old : { start, cards: slice });
    }
    previous.current = lines;
    return lines;
  }, [cards, columns]);
}

const GridLine = memo(function GridLine({ line, index, ...cell }: { line: Line; index: number } & Omit<CellProps, "card" | "index">) {
  return (
    <FocusSection focusKey={`${cell.focusPrefix}:line:${index}`} reveal={LINE_REVEALS[gridLineReveal(index)]} style={styles.columns}>
      {line.cards.map((card, i) => (
        // Clé de PLACE : recyclée, la ligne garde ses cartes (cf. en-tête).
        <Cell key={i} card={card} index={line.start + i} {...cell} />
      ))}
    </FocusSection>
  );
});

export const PosterGrid = memo(function PosterGrid({
  cards,
  columns = 6,
  header,
  empty,
  footer,
  focusPrefix = GRID_KEY_PREFIX,
  onPressCard,
  onLongPressCard,
  onFocusCard,
  onEndReached,
}: PosterGridProps) {
  const width = posterWidth(columns);
  const lines = useLines(cards, columns);
  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<Line>) => (
      <GridLine
        line={item}
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
    // FlashList veut un parent de taille connue : la scène.
    <View style={styles.list}>
      <FlashList
        // Le nombre de colonnes ne change pas à chaud : une clé neuve remonte la liste.
        key={`grid-${columns}`}
        data={lines}
        keyExtractor={lineKey}
        renderItem={renderItem}
        estimatedItemSize={lineStride(width)}
        // Deux lignes d'avance de chaque côté (la liste étend ensuite son
        // avance par étapes) : une flèche maintenue trouve toujours la ligne
        // suivante montée — la règle des sections la cherche parmi les
        // lignes présentes.
        drawDistance={DRAW_DISTANCE}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={footer}
        ItemSeparatorComponent={Separator}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        // Pas de barre d'index du défilement rapide de tvOS (flèche maintenue) :
        // la grille n'en montre aucune, et tvOS la refabriquait pourtant —
        // étiquettes comprises — à chaque lot de lignes ajouté et à chaque
        // battement du défilement rapide. Mesuré au profileur : le premier
        // poste du fil d'interface en défilement rapide.
        overrideProps={SCROLL_PROPS}
        onEndReached={onEndReached}
        // La page suivante part à trois écrans de la fin : quand le focus
        // dévale (flèche maintenue, glisser vif), elle est là avant lui.
        onEndReachedThreshold={GRID_END_REACHED_SCREENS}
      />
    </View>
  );
});

const lineKey = (line: Line) => line.cards[0].id;

/** La hauteur d'une légende d'affiche (titre, année) : une estimation, la
 *  liste mesure les lignes réelles. */
const CAPTION_ESTIMATE = 67;

/** D'une ligne à la suivante : l'affiche, sa légende, l'espace. */
function lineStride(width: number): number {
  return Math.round(width * 1.5) + CAPTION_ESTIMATE + GRID_ROW_GAP;
}

/** Ce que la liste garde monté au-delà de l'écran, de chaque côté. */
const DRAW_DISTANCE = 1100;

const SCROLL_PROPS = { showsScrollIndex: false };

/** La hauteur de la scène : une hauteur explicite (un `flex: 1` peut écraser
 *  la grille à 1 point sous un guide de focus sans style). */
const STAGE_HEIGHT = 1080;

const styles = StyleSheet.create({
  list: { height: STAGE_HEIGHT },
  content: {
    paddingLeft: TV_STAGE.contentLeft,
    paddingRight: TV_STAGE.safe.x,
    paddingTop: TV_STAGE.safe.y,
    paddingBottom: 160,
  },
  columns: { flexDirection: "row", gap: GRID_GAP },
  separator: { height: GRID_ROW_GAP },
});
