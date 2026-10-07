import { memo, useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { TV_STAGE } from "@tentacle-tv/theme";
import { CardFocusFooter } from "../../cards/CardFocusFooter";
import { cardIndexOf } from "../../cards/cardFocusKeys";
import { MediaCard } from "../../cards/MediaCard";
import { FocusSection } from "../../focus/FocusSection";
import { useForcedFocusKey } from "../../focus/focusPreview";
import { useStagedRow } from "../../rows/rowStage";
import { useFocusProgress } from "../../focus/useFocusProgress";
import { useRowFocus } from "../../motion/useRowRecede";
import { colors, fonts } from "../../theme/tokens";
import { DETAIL_LEFT } from "./DetailSection";
import type { SagaEntryModel } from "./detailTypes";
import { CARD_FOCUS_SCALE } from "../../cards/cardFocus";

/**
 * La saga d'un film, dans l'ordre de TMDB : les affiches des volets de la
 * bibliothèque (leurs marqueurs), et à leur rang ceux qui manquent — leur
 * affiche TMDB grisée et un badge (`card.absent`, `AbsentArtwork`), ou, sans
 * affiche, un cadre qui écrit leur titre et leur année. Sous chaque carte, le
 * titre puis « Volet 2 · Cette fiche », la mention (Cette fiche, Reprendre,
 * À suivre) en rose. Le film ouvert reste focalisable, inerte.
 *
 * Contrat : `useSagaView` → `buildSagaView` (ordre, rangs, mentions),
 * `sagaTitle` / `sagaSummary` / `sagaLabel`. Les volets absents viennent des
 * `parts` de TMDB (`/api/sagas`). Un volet `holdable: false` n'a pas d'appui
 * maintenu, et ne l'annonce pas. Groupe de focus : `detail:saga` ; éléments
 * `saga:<i>`.
 */

const { width: W } = TV_STAGE.card.poster;
const H = Math.round(W * 1.5);
const SHIFT = H * (CARD_FOCUS_SCALE - 1);

function Caption({ entry, focused, hold = false }: { entry: SagaEntryModel; focused: boolean; hold?: boolean }) {
  const p = useFocusProgress(focused);
  const shift = useAnimatedStyle(() => ({ transform: [{ translateY: SHIFT * p.value }] }));
  const rank = entry.rank ?? null;
  const cue = entry.cue ?? null;
  return (
    <Animated.View style={[styles.caption, shift]}>
      <Text style={[styles.title, focused && styles.titleFocused]} numberOfLines={1}>{entry.card.title}</Text>
      <Text style={styles.label} numberOfLines={1}>
        {rank}
        {rank && cue ? " · " : ""}
        {cue ? <Text style={styles.cue}>{cue}</Text> : null}
      </Text>
      <CardFocusFooter note={focused ? entry.card.focusNote : undefined} hold={hold} width={Math.round(W * 1.6)} />
    </Animated.View>
  );
}

interface SagaEntryProps {
  entry: SagaEntryModel;
  index: number;
  row: SharedValue<number>;
  onItemFocusChange: (index: number, focused: boolean) => void;
  onOpen?: (entry: SagaEntryModel) => void;
  onLongPress?: (entry: SagaEntryModel) => void;
  onFocusChange?: (focused: boolean) => void;
}

/**
 * Un volet : son affiche (`MediaCard`, grisée s'il est absent) garde son
 * focus pour elle ; le volet le suit dans SON état, pour sa légende — un pas
 * du focus ne redessine que les deux volets qu'il quitte et qu'il atteint,
 * jamais la rangée (le recul des voisins passe par `row`).
 */
const SagaEntry = memo(function SagaEntry({ entry, index, row, onItemFocusChange, onOpen, onLongPress, onFocusChange }: SagaEntryProps) {
  const [native, setNative] = useState(false);
  const forced = useForcedFocusKey();
  const focused = forced !== null ? cardIndexOf(forced, "saga") === index : native;
  const place = useMemo(() => ({ row, index }), [row, index]);
  const focusChange = useCallback(
    (next: boolean) => {
      setNative(next);
      onItemFocusChange(index, next);
      onFocusChange?.(next);
    },
    [index, onItemFocusChange, onFocusChange],
  );
  const press = onOpen && !entry.current ? () => onOpen(entry) : undefined;
  const hold = onLongPress && entry.holdable !== false ? () => onLongPress(entry) : undefined;
  return (
    <View style={{ width: W }}>
      <MediaCard
        card={entry.card}
        variant="poster"
        hideCaption
        place={place}
        focusKey={`saga:${index}`}
        onPress={press}
        onLongPress={hold}
        onFocusChange={focusChange}
      />
      <Caption entry={entry} focused={focused} hold={focused && hold !== undefined} />
    </View>
  );
});

export const SagaRow = memo(function SagaRow({
  entries,
  stageRank,
  onOpen,
  onLongPress,
  onFocusChange,
}: {
  entries: SagaEntryModel[];
  /** Sa place dans une page échelonnée (`rowStage`, Android TV). */
  stageRank?: number;
  onOpen?: (entry: SagaEntryModel) => void;
  onLongPress?: (entry: SagaEntryModel) => void;
  onFocusChange?: (focused: boolean) => void;
}) {
  const forced = useForcedFocusKey();
  const { row, onItemFocusChange } = useRowFocus(forced !== null, forced !== null ? cardIndexOf(forced, "saga") : null);
  const { shown, demand } = useStagedRow(stageRank, entries.length);
  const onItem = useCallback(
    (index: number, focused: boolean) => {
      onItemFocusChange(index, focused);
      if (focused) demand();
    },
    [onItemFocusChange, demand],
  );
  return (
    <FocusSection focusKey="detail:saga">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.track} contentContainerStyle={styles.content}>
        {entries.slice(0, shown).map((entry, index) => (
          <SagaEntry
            key={entry.key}
            entry={entry}
            index={index}
            row={row}
            onItemFocusChange={onItem}
            onOpen={onOpen}
            onLongPress={onLongPress}
            onFocusChange={onFocusChange}
          />
        ))}
      </ScrollView>
    </FocusSection>
  );
});

const styles = StyleSheet.create({
  track: { overflow: "visible" },
  content: { gap: TV_STAGE.row.gap, paddingLeft: DETAIL_LEFT, paddingRight: TV_STAGE.safe.x, paddingTop: 12, paddingBottom: 24 },
  caption: { marginTop: 16, gap: 2 },
  title: { ...fonts.semibold, fontSize: 24, color: colors.textSecondary },
  titleFocused: { color: colors.text },
  label: { ...fonts.medium, fontSize: 22, color: colors.textTertiary },
  cue: { ...fonts.semibold, fontSize: 22, color: colors.accentLight },
});
