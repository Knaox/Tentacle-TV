import { memo, useCallback, useEffect, useMemo, useRef, type ReactElement } from "react";
import { StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { FlashList, type ListRenderItemInfo } from "@shopify/flash-list";
import { TV_STAGE } from "@tentacle-tv/theme";
import { GRID_END_REACHED_SCREENS, GRID_KEY_PREFIX } from "@tentacle-tv/tv-core";
import { useCardMetrics } from "../../cards/cardSizeMode";
import type { CardModel } from "../../cards/cardTypes";
import { PreviewRevealProvider, type PreviewReveal } from "../../rows/previewRevealPort";
import { GridCarouselLine, type GridLineModel } from "./GridCarouselLine";
import { createGridMotion } from "./gridMotion";
import { useGridLinePush } from "./gridLinePush";
import { useGridPreviewWarm } from "./gridPreviewWarm";
import { useGridAhead } from "./useGridAhead";
import { mountProfile } from "../../render/mountProfile";

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
 *
 * L'aperçu au focus (Apple TV, Android TV) : chaque ligne est un CARROUSEL
 * de l'accueil sans titre (`GridCarouselLine`, tv-core
 * `cards/trailerPreviewGrid.ts`) — l'affiche dont l'aperçu démarre devient la
 * grande carte, passe en tête de sa ligne (ou en butée au bout), sa légende
 * dessous ; les lignes du dessous descendent d'autant (`gridLinePush`), la
 * page aussi si la ligne dépasse en bas. HAUT et BAS gardent la colonne
 * (l'intégration déclare l'entrée des lignes voisines, tv-core
 * `gridLineEntries`). Les aperçus de sa ligne et de la suivante se préparent
 * d'avance.
 */

export interface PosterGridProps {
  cards: CardModel[];
  /** Absentes : celles de la taille des cartes réglée (`useGridColumns`). */
  columns?: number;
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

/** Les colonnes d'une grille : celles qu'on lui impose, sinon celles de la
 *  taille des cartes réglée (Petite 7, Normale 6, Grande 5 — tv-core
 *  `cardMetricsOf`). La largeur d'une affiche suit (`posterWidth`). */
export function useGridColumns(columns?: number): number {
  const metrics = useCardMetrics();
  return columns ?? metrics.gridColumns;
}

/** La largeur d'une affiche pour `columns` colonnes. */
export function posterWidth(columns: number): number {
  return Math.floor((GRID_WIDTH - GRID_GAP * (columns - 1)) / columns);
}

const Separator = () => <View style={styles.separator} />;

type Line = GridLineModel;

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

export const PosterGrid = memo(function PosterGrid({
  cards,
  columns: forcedColumns,
  header,
  empty,
  footer,
  focusPrefix = GRID_KEY_PREFIX,
  onPressCard,
  onLongPressCard,
  onFocusCard,
  onEndReached,
}: PosterGridProps) {
  const columns = useGridColumns(forcedColumns);
  const width = posterWidth(columns);
  const lines = useLines(cards, columns);
  const list = useRef<FlashList<Line>>(null);
  const focusCard = useGridAhead(list, cards, columns, onFocusCard);
  // Le mouvement de la grille : la préparation attend qu'elle se pose (`gridMotion`).
  const motion = useMemo(() => createGridMotion(), []);
  useEffect(() => () => motion.dispose(), [motion]);
  // Le défilement de la page, relevé sans rendu : la grande carte qui dépasse en bas l'y fait descendre.
  const scrollY = useRef(0);
  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollY.current = event.nativeEvent.contentOffset.y;
      motion.scrolled(scrollY.current);
    },
    [motion],
  );
  const reveal = useMemo<PreviewReveal>(
    () => ({ scrollBy: (by) => list.current?.scrollToOffset({ offset: scrollY.current + by, animated: true }) }),
    [],
  );
  const warm = useGridPreviewWarm(cards, columns, motion);
  const push = useGridLinePush();
  const height = lineHeight(width);
  const stride = lineStride(width);
  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<Line>) => (
      <GridCarouselLine
        line={item}
        index={index}
        width={width}
        height={height}
        stride={stride}
        motion={motion}
        push={push}
        focusPrefix={focusPrefix}
        onPressCard={onPressCard}
        onLongPressCard={onLongPressCard}
        onFocusCard={focusCard}
        onWarm={warm}
      />
    ),
    [motion, push, width, height, stride, focusPrefix, onPressCard, onLongPressCard, focusCard, warm],
  );
  return (
    // FlashList veut un parent de taille connue : la scène.
    <PreviewRevealProvider reveal={reveal}>
      <View style={styles.list}>
        <FlashList
          ref={list}
          // Le nombre de colonnes ne change pas à chaud : une clé neuve remonte la liste.
          key={`grid-${columns}`}
          data={lines}
          keyExtractor={lineKey}
          renderItem={renderItem}
          estimatedItemSize={stride}
          // Deux lignes d'avance de chaque côté (la liste étend ensuite son
          // avance par étapes) : une flèche maintenue trouve toujours la ligne
          // suivante montée — la règle des sections la cherche parmi les
          // lignes présentes. Le profil de montage la règle (`mountProfile` :
          // une ligne en mode Lite).
          drawDistance={mountProfile().gridDrawDistance}
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
          onScroll={onScroll}
          // La page suivante part à trois écrans de la fin : quand le focus
          // dévale (flèche maintenue, glisser vif), elle est là avant lui.
          onEndReachedThreshold={GRID_END_REACHED_SCREENS}
        />
      </View>
    </PreviewRevealProvider>
  );
});

const lineKey = (line: Line) => line.cards[0].id;

/** La légende d'une affiche au repos (`MediaCard`) : 14 de marge, le titre (24)
 *  et l'année (22) à 1,21 em la ligne (Inter), 2 entre les deux. */
const CAPTION_HEIGHT = 72;

/** La hauteur d'une ligne au repos, fixe : ce que la grande carte gagne déborde (`GridCarouselLine`). */
function lineHeight(width: number): number {
  return Math.round(width * 1.5) + CAPTION_HEIGHT;
}

/** D'une ligne à la suivante : l'affiche, sa légende, l'espace. */
function lineStride(width: number): number {
  return lineHeight(width) + GRID_ROW_GAP;
}

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
  separator: { height: GRID_ROW_GAP },
});
