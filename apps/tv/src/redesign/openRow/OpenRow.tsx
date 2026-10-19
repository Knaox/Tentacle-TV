import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSharedValue } from "react-native-reanimated";
import { OPEN_ROW, ROW_STAGING, rowHeadCards, trailerPreviewWarmWindow, type OpenCardMetrics } from "@tentacle-tv/tv-core";
import { cardIndexOf } from "../cards/cardFocusKeys";
import type { CardModel } from "../cards/cardTypes";
import { useCardPreviewWarm } from "../cards/trailerPreviewPort";
import { useForcedFocusKey } from "../focus/focusPreview";
import { useRowFocus } from "../motion/useRowRecede";
import { mountProfile } from "../render/mountProfile";
import { CullingTrack } from "../rows/CullingTrack";
import { useRowRewindPort } from "../rows/rowRewindPort";
import { useStagedRow } from "../rows/rowStage";
import { colors, fonts, text } from "../theme/tokens";
import { OpenCard, type OpenRowPlace } from "./OpenCard";
import { OpenDetails } from "./OpenDetails";

/**
 * Une rangée à cartes qui S'OUVRENT (tv-core `cards/openCard.ts`) — l'Accueil,
 * « Pour vous », les listes et les bibliothèques : son titre (et son nombre de
 * titres, pour une rangée de bibliothèque), ses affiches, et la carte
 * focalisée ouverte en 16:9 au bord gauche (la section : `rowRevealStart`),
 * ses détails dessous. La hauteur de la rangée est FIXE (`metrics.rowHeight`) :
 * un pas du focus ne remet rien en page.
 *
 * La piste garde de quoi poser sa DERNIÈRE carte au bord gauche (la marge de
 * fin : l'écran moins une affiche). La rangée revient à son début une fois
 * sortie de l'écran (`rowRewindPort`, comme `MediaRow`), et se monte par
 * échelons (`rowStage`, Android TV). La clé de focus d'une carte est
 * `${rowKey}:${index}`.
 */

export interface OpenRowProps {
  rowKey: string;
  title: string;
  /** Le nombre de titres d'une rangée de bibliothèque (« Drame · 31 »). */
  count?: number;
  cards: CardModel[];
  metrics: OpenCardMetrics;
  inset: number;
  accessory?: React.ReactNode;
  stageRank?: number;
  /** Ce que fait OK sur ses titres de la bibliothèque (défaut : « OK : ouvrir la fiche »). */
  okHint?: string;
  /** Ses titres ne sont pas encore là : des affiches fantômes, à la même hauteur (rien ne bouge à leur arrivée). */
  pending?: boolean;
  /** Le focus approche de la dernière carte chargée : la suite. */
  onNearEnd?: () => void;
  onPressCard?: (card: CardModel) => void;
  onLongPressCard?: (card: CardModel) => void;
  onFocusCard?: (card: CardModel) => void;
}

const VIEWPORT = 1920;
/** À tant de cartes de la fin chargée, la suite est demandée. */
const NEAR_END = 8;
/** Les affiches fantômes d'une rangée en attente. */
const PENDING_CARDS = 6;

export const OpenRow = memo(function OpenRow({
  rowKey, title, count, cards, metrics, inset, accessory, stageRank, okHint, pending = false, onNearEnd, onPressCard, onLongPressCard, onFocusCard,
}: OpenRowProps) {
  const forced = useForcedFocusKey();
  const track = useRef<ScrollView>(null);
  const head = mountProfile().fitRowHeads ? rowHeadCards(VIEWPORT - inset, metrics.step) : ROW_STAGING.headCards;
  const { shown, demand } = useStagedRow(stageRank, cards.length, head);
  const { row: focused, onItemFocusChange } = useRowFocus(forced !== null, forced !== null ? cardIndexOf(forced, rowKey) : null);
  // La dernière carte focalisée : celle que la rangée pose au bord gauche ; celles d'avant sont passées.
  const anchor = useSharedValue(forced !== null ? cardIndexOf(forced, rowKey) ?? 0 : 0);
  const rewind = useRowRewindPort();
  const toStart = useRef<() => void>(() => undefined);
  toStart.current = () => {
    track.current?.scrollTo({ x: 0, y: 0, animated: false });
    anchor.value = 0;
  };
  useEffect(() => rewind?.register(rowKey, () => toStart.current()), [rewind, rowKey]);
  const warm = useCardPreviewWarm();
  const latest = useRef(cards);
  latest.current = cards;
  const nearEnd = useRef(onNearEnd);
  nearEnd.current = onNearEnd;

  const onItemFocus = useCallback(
    (index: number, isFocused: boolean, card: CardModel) => {
      onItemFocusChange(index, isFocused);
      if (!isFocused) return;
      anchor.value = index;
      if (mountProfile().rowTails === "eager" || index > 0) demand();
      if (index >= latest.current.length - NEAR_END) nearEnd.current?.();
      if (warm) {
        const [start, end] = trailerPreviewWarmWindow(index, latest.current.length);
        warm(latest.current.slice(start, end));
      }
      onFocusCard?.(card);
    },
    [onItemFocusChange, anchor, demand, warm, onFocusCard],
  );
  const ids = useMemo(() => new Set(cards.map((card) => card.id)), [cards]);

  if (pending) return <PendingRow title={title} metrics={metrics} inset={inset} />;
  if (cards.length === 0 || shown === 0) return null;
  return (
    <View style={{ height: metrics.rowHeight }}>
      <View style={[styles.header, { paddingLeft: inset }]}>
        <Text style={text.rowTitle} numberOfLines={1}>{title}</Text>
        {count !== undefined ? <Text style={styles.count}>{count}</Text> : null}
        {accessory}
      </View>
      <ScrollView
        ref={track}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.track}
        contentContainerStyle={{ paddingLeft: inset, paddingRight: VIEWPORT - inset - metrics.posterWidth, gap: metrics.gap }}
      >
        <CullingTrack gap={metrics.gap}>
          {cards.slice(0, shown).map((card, index) => (
            <RowCard key={card.id} card={card} index={index} focused={focused} anchor={anchor} rowKey={rowKey} metrics={metrics} onPressCard={onPressCard} onLongPressCard={onLongPressCard} onItemFocus={onItemFocus} />
          ))}
        </CullingTrack>
      </ScrollView>
      <OpenDetails ids={ids} rowFocus={focused} top={metrics.detailsTop} left={inset} width={metrics.openWidth} okHint={okHint} />
    </View>
  );
});

/** Une rangée en attente : son titre et des affiches fantômes, immobiles (rien ne s'anime au repos). */
function PendingRow({ title, metrics, inset }: { title: string; metrics: OpenCardMetrics; inset: number }) {
  return (
    <View style={{ height: metrics.rowHeight }}>
      <View style={[styles.header, { paddingLeft: inset }]}>
        <Text style={text.rowTitle} numberOfLines={1}>{title}</Text>
      </View>
      <View style={[styles.pending, { paddingLeft: inset, gap: metrics.gap }]}>
        {Array.from({ length: PENDING_CARDS }, (_, i) => (
          <View key={i} style={[styles.ghost, { width: metrics.posterWidth, height: metrics.height, borderRadius: metrics.posterRadius }]} />
        ))}
      </View>
    </View>
  );
}

/** Une carte de la rangée, ses gestionnaires liés à SA carte une fois pour toutes. */
const RowCard = memo(function RowCard({ card, index, focused, anchor, rowKey, metrics, onPressCard, onLongPressCard, onItemFocus }: {
  card: CardModel;
  index: number;
  focused: OpenRowPlace["focused"];
  anchor: OpenRowPlace["anchor"];
  rowKey: string;
  metrics: OpenCardMetrics;
  onPressCard?: (card: CardModel) => void;
  onLongPressCard?: (card: CardModel) => void;
  onItemFocus: (index: number, focused: boolean, card: CardModel) => void;
}) {
  const place = useMemo(() => ({ focused, anchor, index }), [focused, anchor, index]);
  const onPress = useMemo(() => (onPressCard ? () => onPressCard(card) : undefined), [onPressCard, card]);
  const onLongPress = useMemo(() => (onLongPressCard ? () => onLongPressCard(card) : undefined), [onLongPressCard, card]);
  const onFocusChange = useCallback((isFocused: boolean) => onItemFocus(index, isFocused, card), [onItemFocus, index, card]);
  return <OpenCard card={card} place={place} metrics={metrics} focusKey={`${rowKey}:${index}`} onPress={onPress} onLongPress={onLongPress} onFocusChange={onFocusChange} />;
});

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "baseline", gap: 14, height: OPEN_ROW.titleHeight - 22, marginBottom: 22 },
  count: { ...fonts.medium, fontSize: 26, color: colors.textTertiary },
  // Le débord laisse la place à la face ouverte, à son ombre et à la légende.
  track: { overflow: "visible", flexGrow: 0 },
  pending: { flexDirection: "row", overflow: "hidden" },
  ghost: { backgroundColor: colors.surface1 },
});
