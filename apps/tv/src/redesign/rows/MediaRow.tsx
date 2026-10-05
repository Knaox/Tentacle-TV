import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import { TV_STAGE } from "@tentacle-tv/theme";
import { cardIndexOf } from "../cards/cardFocusKeys";
import { MediaCard } from "../cards/MediaCard";
import { MORPH_OVERFLOW, MorphCard } from "../cards/MorphCard";
import type { CardModel } from "../cards/cardTypes";
import { useForcedFocusKey } from "../focus/focusPreview";
import { useRowFocus } from "../motion/useRowRecede";
import { text } from "../theme/tokens";
import { CullingTrack } from "./CullingTrack";
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
  onPressCard,
  onLongPressCard,
  onFocusCard,
}: MediaRowProps) {
  const forced = useForcedFocusKey();
  const track = useRef<ScrollView>(null);
  const rewind = useRowRewindPort();
  useEffect(
    () => rewind?.register(rowKey, () => track.current?.scrollTo({ x: 0, y: 0, animated: false })),
    [rewind, rowKey],
  );
  const { row, onItemFocusChange } = useRowFocus(forced !== null, forced !== null ? cardIndexOf(forced, rowKey) : null);
  const { shown, demand } = useStagedRow(stageRank, cards.length);

  const onItemFocus = useCallback(
    (index: number, focused: boolean, card: CardModel) => {
      onItemFocusChange(index, focused);
      if (!focused) return;
      // Parcourue : ce que l'échelonnement ne lui a pas encore monté passe devant.
      demand();
      onFocusCard?.(card);
    },
    [onFocusCard, onItemFocusChange, demand],
  );

  // Rien tant que l'échelonnement ne lui a rien libéré : jamais une piste
  // vide (une ScrollView sans cartes prendrait le focus sur Android).
  if (cards.length === 0 || shown === 0) return null;
  return (
    <View style={styles.row}>
      <View style={[styles.header, { paddingLeft: inset }]}>
        <Text style={text.rowTitle} numberOfLines={1}>{title}</Text>
        {accessory}
      </View>
      <ScrollView
        ref={track}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.track}
        contentContainerStyle={[
          styles.content,
          { paddingLeft: inset, paddingRight: TV_STAGE.safe.x },
          variant === "morph" && styles.morphContent,
        ]}
      >
        <CullingTrack gap={TV_STAGE.row.gap}>
          {cards.slice(0, shown).map((card, index) => (
            <RowCard
              key={card.id}
              card={card}
              index={index}
              row={row}
              rowKey={rowKey}
              variant={variant}
              width={cardWidth}
              onPressCard={onPressCard}
              onLongPressCard={onLongPressCard}
              onItemFocus={onItemFocus}
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
  width,
  onPressCard,
  onLongPressCard,
  onItemFocus,
}: {
  card: CardModel;
  index: number;
  row: SharedValue<number>;
  rowKey: string;
  variant: MediaRowProps["variant"];
  width?: number;
  onPressCard?: (card: CardModel) => void;
  onLongPressCard?: (card: CardModel) => void;
  onItemFocus: (index: number, focused: boolean, card: CardModel) => void;
}) {
  const place = useMemo(() => ({ row, index }), [row, index]);
  const onPress = useMemo(() => (onPressCard ? () => onPressCard(card) : undefined), [onPressCard, card]);
  const onLongPress = useMemo(() => (onLongPressCard ? () => onLongPressCard(card) : undefined), [onLongPressCard, card]);
  const onFocusChange = useCallback((focused: boolean) => onItemFocus(index, focused, card), [onItemFocus, index, card]);
  const common = { card, focusKey: `${rowKey}:${index}`, place, onPress, onLongPress, onFocusChange };
  return variant === "morph" ? <MorphCard {...common} /> : <MediaCard {...common} variant={variant} width={width} />;
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
