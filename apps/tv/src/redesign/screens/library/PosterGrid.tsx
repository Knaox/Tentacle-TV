import { memo, useCallback, useEffect, useMemo, useRef, type ReactElement } from "react";
import { StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { FlashList, type ListRenderItemInfo } from "@shopify/flash-list";
import { TV_STAGE } from "@tentacle-tv/theme";
import { GRID_END_REACHED_SCREENS, GRID_KEY_PREFIX, belowZoneBottomRoom } from "@tentacle-tv/tv-core";
import { useCardMetrics } from "../../cards/cardSizeMode";
import type { CardModel } from "../../cards/cardTypes";
import { GridLine, type GridLineModel } from "./GridLine";
import { createGridMotion } from "./gridMotion";
import { useGridPreviewWarm } from "./gridPreviewWarm";
import { useGridSettlePort } from "./gridSettlePort";
import { useGridAhead } from "./useGridAhead";
import { mountProfile } from "../../render/mountProfile";
import { FocusSection, type FocusSectionReveal } from "../../focus/FocusSection";
import { PreviewZoneSlot } from "../../cards/trailerPreviewPort";
import { BelowZonePage } from "../../rows/BelowZonePage";

/**
 * La grille d'affiches des pages de catalogue — bibliothèque, Ma liste,
 * Favoris, Parcourir, une collection : de grandes affiches 2:3, cinq ou six par ligne, leur
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
 * se pose TOUJOURS au même endroit, juste sous la zone fixe de l'aperçu
 * (`BelowZonePage`, tv-core `previewZoneLayout.ts`), en un seul mouvement —
 * la première comme les autres ; l'en-tête, lui, ramène la page tout en haut
 * (titre et filtres).
 *
 * Les lignes sont RECYCLÉES (FlashList) : une ligne qui sort de l'écran sert
 * à celle qui arrive, ses cartes reçoivent un autre titre au lieu d'être
 * démontées et remontées — dans une bibliothèque de mille titres, défiler ne
 * crée plus ni vue native ni valeur animée. Les cartes d'une ligne sont donc
 * clées par leur PLACE, et une carte qui change de titre change d'image sans
 * jamais montrer la précédente (`MediaCard`).
 *
 * L'aperçu au focus (Apple TV, Android TV) : chaque ligne est FIXE
 * (`GridLine`, tv-core `cards/trailerPreviewGrid.ts`) — elle ne défile ni ne
 * tourne, rien n'y grandit, GAUCHE et DROITE ne font que déplacer le focus ;
 * l'aperçu se joue dans la zone fixe en haut de l'écran. HAUT et BAS gardent
 * la colonne (l'intégration déclare l'entrée des lignes voisines, tv-core
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
  // Le mouvement de la grille — son focus, son défilement : la préparation attend qu'elle se pose (`gridMotion`).
  const motion = useMemo(() => createGridMotion(), []);
  useEffect(() => () => motion.dispose(), [motion]);
  // La grille posée, l'intégration rend la colonne si un défilement accéléré l'a perdue (`gridSettlePort`).
  const settled = useGridSettlePort();
  useEffect(() => (settled ? motion.onSettled(settled) : undefined), [motion, settled]);
  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => motion.scrolled(event.nativeEvent.contentOffset.y), [motion]);
  const warm = useGridPreviewWarm(cards, columns, motion);
  const height = lineHeight(width);
  const stride = lineStride(width);
  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<Line>) => (
      <GridLine
        line={item}
        index={index}
        width={width}
        height={height}
        stride={stride}
        motion={motion}
        focusPrefix={focusPrefix}
        onPressCard={onPressCard}
        onLongPressCard={onLongPressCard}
        onFocusCard={focusCard}
        onWarm={warm}
      />
    ),
    [motion, width, height, stride, focusPrefix, onPressCard, onLongPressCard, focusCard, warm],
  );
  // Assez de place sous la dernière ligne pour qu'elle se pose sous la zone, comme les autres.
  const content = useMemo(() => ({ ...styles.content, paddingBottom: Math.max(GRID_BOTTOM, belowZoneBottomRoom(height)) }), [height]);
  // L'en-tête (titre, filtres, Retour) ramène la page tout en haut quand le focus y remonte :
  // les lignes, elles, se posent sous la zone (`BELOW_ZONE_REVEAL`, `GridLine`).
  const shownHeader = useMemo(() => (header ? <FocusSection reveal={HEADER_REVEAL}>{header}</FocusSection> : header), [header]);
  return (
    // La zone d'aperçu de la grille : avant tout focus d'affiche, la première (`fallback`).
    <BelowZonePage zone={<PreviewZoneSlot fallback={cards[0] ?? null} />}>
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
        ListHeaderComponent={shownHeader}
        ListEmptyComponent={empty}
        ListFooterComponent={footer}
        ItemSeparatorComponent={Separator}
        contentContainerStyle={content}
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
    </BelowZonePage>
  );
});

const lineKey = (line: Line) => line.cards[0].id;

/** La marge du bas, au moins. */
const GRID_BOTTOM = 160;

const HEADER_REVEAL: FocusSectionReveal = { mode: "start" };

/** La légende d'une affiche au repos (`MediaCard`) : 14 de marge, le titre (24)
 *  et l'année (22) à 1,21 em la ligne (Inter), 2 entre les deux. */
const CAPTION_HEIGHT = 72;

/** La hauteur d'une ligne au repos, fixe : la ligne ne grandit jamais (`GridLine`). */
function lineHeight(width: number): number {
  return Math.round(width * 1.5) + CAPTION_HEIGHT;
}

/** D'une ligne à la suivante : l'affiche, sa légende, l'espace. */
function lineStride(width: number): number {
  return lineHeight(width) + GRID_ROW_GAP;
}

const SCROLL_PROPS = { showsScrollIndex: false };

const styles = StyleSheet.create({
  content: {
    paddingLeft: TV_STAGE.contentLeft,
    paddingRight: TV_STAGE.safe.x,
    paddingTop: TV_STAGE.safe.y,
    paddingBottom: GRID_BOTTOM,
  },
  separator: { height: GRID_ROW_GAP },
});
