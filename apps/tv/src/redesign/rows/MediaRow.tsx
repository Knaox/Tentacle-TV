import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { useAnimatedRef, type SharedValue } from "react-native-reanimated";
import { TV_STAGE } from "@tentacle-tv/theme";
import { ROW_STAGING, rowHeadCards, trailerPreviewWarmWindow } from "@tentacle-tv/tv-core";
import { cardIndexOf } from "../cards/cardFocusKeys";
import { MediaCard } from "../cards/MediaCard";
import { MORPH_OVERFLOW, MorphCard } from "../cards/MorphCard";
import type { CardModel } from "../cards/cardTypes";
import { useCardPreviewWarm } from "../cards/trailerPreviewPort";
import { useForcedFocusKey } from "../focus/focusPreview";
import { mountProfile } from "../render/mountProfile";
import { useRowFocus } from "../motion/useRowRecede";
import { text } from "../theme/tokens";
import { useCardMetrics } from "../cards/cardSizeMode";
import { CullingTrack, NATIVE_RECEDE } from "./CullingTrack";
import { useRowPreviewRoom } from "./rowPreviewRoom";
import { useRowRewindPort } from "./rowRewindPort";
import { useStagedRow } from "./rowStage";

/**
 * Une rangée : son titre (36 pt), puis ses cartes à l'horizontale, peu
 * nombreuses et grandes. Quand une carte a le focus, ses voisines reculent
 * un peu — par une valeur partagée que chaque carte lit sur le fil
 * d'interface (`useRowFocus`) : un pas du focus ne redessine pas la rangée.
 * La clé de focus d'une carte est `${rowKey}:${index}`.
 *
 * Sur une page qui le demande (l'accueil, « Pour vous » : `rowRewindPort`),
 * la rangée se déclare avec sa remise au début — l'intégration la ramène à sa
 * première carte, sans animation, une fois sortie de l'écran.
 *
 * `stageRank` : sa place dans une page dont les rangées se montent par
 * échelons (`rowStage`, Android TV) — elle ne rend que les cartes libérées.
 * Chaque carte est mémoïsée avec des gestionnaires STABLES (`RowCard`) : une
 * rangée qui s'allonge, ou dont la liste change, ne redessine pas les cartes
 * qu'elle a déjà.
 *
 * Ses vignettes et ses affiches peuvent devenir la GRANDE CARTE de l'aperçu
 * de leur bande-annonce (`CardPreviewTile`) : la rangée leur fait place, et
 * la carte dont l'aperçu démarre passe EN TÊTE — la rangée défile pour
 * qu'elle prenne la place de la première, la place réservée d'abord vers la
 * fin de la rangée (`rowPreviewRoom`). Une carte qui se redresse (`morph`) ne
 * grandit pas.
 */

/** Le vide sous les cartes d'une rangée (sa marge et le bas de sa piste) : rien ne s'y voit au repos. */
export const MEDIA_ROW_TRAILING = TV_STAGE.row.spacing;

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
  /** Sa place dans une page échelonnée (`rowStage`), de haut en bas. */
  stageRank?: number;
  /** Les cartes clées par leur PLACE plutôt que par leur titre : une liste
   *  qui change entière (les résultats d'une frappe) REDESSINE ses cartes
   *  au lieu de les démonter et d'en monter d'autres. */
  recycleCards?: boolean;
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
  stageRank,
  recycleCards = false,
  onPressCard,
  onLongPressCard,
  onFocusCard,
}: MediaRowProps) {
  const forced = useForcedFocusKey();
  // Une référence animée : le passage en tête défile sur le fil d'interface (`rowGlide`).
  const track = useAnimatedRef<ScrollView>();
  // Le défilement de la piste, relevé sans rendu : la grande carte s'y mesure.
  // Étranglé à 100 ms, il est relu aussi à la fin d'un défilement (sa vraie fin).
  const scrollX = useRef(0);
  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollX.current = event.nativeEvent.contentOffset.x;
  }, []);
  // La largeur des cartes de la variante : celle de `MediaCard`, à la taille réglée.
  const metrics = useCardMetrics();
  const width = cardWidth ?? (variant === "morph" ? metrics.landscape.width : metrics[variant].width);
  const rewind = useRowRewindPort();
  // Mode Lite : la tête ajustée à ce que la piste montre (`rowHeadCards`).
  const head = mountProfile().fitRowHeads && variant !== "morph" ? rowHeadCards(1920 - inset, width + TV_STAGE.row.gap) : ROW_STAGING.headCards;
  const { shown, demand, retire } = useStagedRow(stageRank, cards.length, head);
  const room = useRowPreviewRoom({ track, scrollX, cardWidth: width, inset, cardCount: Math.min(shown, cards.length) });
  const { onRewind: rewindRoom, onCardFocus: focusRoom } = room;
  // La carte qui a le focus dans la rangée, ou null : jamais retirée sous le focus.
  const focusedIndex = useRef<number | null>(null);
  useEffect(
    () =>
      rewind?.register(rowKey, () => {
        track.current?.scrollTo({ x: 0, y: 0, animated: false });
        rewindRoom();
        // Sortie de l'écran (ou page quittée) : elle revient à sa tête (mode Lite),
        // à l'image suivante — sauf si le focus est (revenu) sur sa queue.
        if (!mountProfile().retireOffscreenRows) return;
        requestAnimationFrame(() => {
          if (focusedIndex.current === null || focusedIndex.current < head) retire();
        });
      }),
    [rewind, rowKey, retire, head, rewindRoom, track],
  );
  // Les titres autour du focus : leur aperçu se prépare au serveur (`useCardPreviewWarm`).
  const warm = useCardPreviewWarm();
  const latestCards = useRef(cards);
  latestCards.current = cards;
  const { row, onItemFocusChange } = useRowFocus(forced !== null, forced !== null ? cardIndexOf(forced, rowKey) : null);
  // La piste joue le recul (Android TV) — sauf au banc, dont le focus figé passe par la valeur partagée.
  const nativeRecede = NATIVE_RECEDE && forced === null;

  const onItemFocus = useCallback(
    (index: number, focused: boolean, card: CardModel) => {
      onItemFocusChange(index, focused);
      focusRoom(index, focused);
      if (focused) focusedIndex.current = index;
      else if (focusedIndex.current === index) focusedIndex.current = null;
      if (!focused) return;
      // Parcourue : ce que l'échelonnement ne lui a pas encore monté passe
      // devant. Queues à la demande (mode Lite) : seulement quand le focus
      // quitte la première carte — la rangée défile ; descendre de rangée en
      // rangée ne monte aucune queue.
      if (mountProfile().rowTails === "eager" || index > 0) demand();
      if (warm && variant !== "morph") {
        const [start, end] = trailerPreviewWarmWindow(index, latestCards.current.length);
        const subjects = latestCards.current.slice(start, end).flatMap((neighbour) => (neighbour.trailer ? [neighbour.trailer] : []));
        if (subjects.length > 0) warm(subjects);
      }
      onFocusCard?.(card);
    },
    [onFocusCard, onItemFocusChange, focusRoom, demand, warm, variant],
  );

  // Rien tant que l'échelonnement ne lui a rien libéré : jamais une piste
  // vide (une ScrollView sans cartes prendrait le focus sur Android).
  if (cards.length === 0 || shown === 0) return null;
  return (
    <View ref={room.rowRef} collapsable={false} style={styles.row}>
      <View style={[styles.header, { paddingLeft: inset }]}>
        <Text style={text.rowTitle} numberOfLines={1}>{title}</Text>
        {accessory}
      </View>
      <ScrollView
        ref={track}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.track}
        onScroll={onScroll}
        onMomentumScrollEnd={onScroll}
        scrollEventThrottle={100}
        onLayout={room.onTrackLayout}
        onContentSizeChange={room.onContentSizeChange}
        contentContainerStyle={[
          styles.content,
          { paddingLeft: inset, paddingRight: TV_STAGE.safe.x + room.reserve },
          variant === "morph" && styles.morphContent,
        ]}
      >
        <CullingTrack gap={TV_STAGE.row.gap} recede={nativeRecede}>
          {cards.slice(0, shown).map((card, index) => (
            <RowCard
              key={recycleCards ? index : card.id}
              card={card}
              index={index}
              row={row}
              rowKey={rowKey}
              variant={variant}
              nativeRecede={nativeRecede}
              width={cardWidth}
              onPressCard={onPressCard}
              onLongPressCard={onLongPressCard}
              onItemFocus={onItemFocus}
              onPreviewExpand={room.onPreviewExpand}
              onPreviewCollapse={room.onPreviewCollapse}
            />
          ))}
        </CullingTrack>
      </ScrollView>
    </View>
  );
});

/** Une carte de la rangée, ses gestionnaires liés à SA carte une fois pour toutes. */
const RowCard = memo(function RowCard({
  card,
  index,
  row,
  rowKey,
  variant,
  nativeRecede,
  width,
  onPressCard,
  onLongPressCard,
  onItemFocus,
  onPreviewExpand,
  onPreviewCollapse,
}: {
  card: CardModel;
  index: number;
  row: SharedValue<number>;
  rowKey: string;
  variant: MediaRowProps["variant"];
  /** Sa piste joue le recul (`CullingTrack`). */
  nativeRecede: boolean;
  width?: number;
  onPressCard?: (card: CardModel) => void;
  onLongPressCard?: (card: CardModel) => void;
  onItemFocus: (index: number, focused: boolean, card: CardModel) => void;
  onPreviewExpand: (index: number, tileWidth: number, tileHeight: number) => void;
  onPreviewCollapse: (index: number) => void;
}) {
  const place = useMemo(() => ({ row, index, native: nativeRecede }), [row, index, nativeRecede]);
  const onPress = useMemo(() => (onPressCard ? () => onPressCard(card) : undefined), [onPressCard, card]);
  const onLongPress = useMemo(() => (onLongPressCard ? () => onLongPressCard(card) : undefined), [onLongPressCard, card]);
  const onFocusChange = useCallback((focused: boolean) => onItemFocus(index, focused, card), [onItemFocus, index, card]);
  const onExpand = useCallback((tileWidth: number, tileHeight: number) => onPreviewExpand(index, tileWidth, tileHeight), [onPreviewExpand, index]);
  const onCollapse = useCallback(() => onPreviewCollapse(index), [onPreviewCollapse, index]);
  const common = { card, focusKey: `${rowKey}:${index}`, place, onPress, onLongPress, onFocusChange };
  return variant === "morph" ? <MorphCard {...common} /> : <MediaCard {...common} variant={variant} width={width} previewable onPreviewExpand={onExpand} onPreviewCollapse={onCollapse} />;
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
