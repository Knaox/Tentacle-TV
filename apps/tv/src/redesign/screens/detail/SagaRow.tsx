import { memo, useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { TV_STAGE } from "@tentacle-tv/theme";
import { CardFocusFooter } from "../../cards/CardFocusFooter";
import { CardFrame } from "../../cards/CardFrame";
import { cardIndexOf } from "../../cards/cardFocusKeys";
import { MediaCard } from "../../cards/MediaCard";
import { FocusGroup } from "../../focus/FocusGroup";
import { FocusTarget } from "../../focus/FocusTarget";
import { useForcedFocusKey } from "../../focus/focusPreview";
import { useFocusProgress } from "../../focus/useFocusProgress";
import { Icon } from "../../icons/Icon";
import { useRowFocus, type RowPlace } from "../../motion/useRowRecede";
import { colors, fonts, white } from "../../theme/tokens";
import { DETAIL_LEFT } from "./DetailSection";
import type { SagaEntryModel } from "./detailTypes";

/**
 * La saga d'un film, dans l'ordre de TMDB : les affiches des volets de la
 * bibliothèque (leurs marqueurs), et à leur rang ceux qui manquent — un
 * cadre sans image, leur titre et leur année écrits dedans. Sous chaque
 * carte, le titre puis « Volet 2 · Cette fiche », la mention (Cette fiche,
 * Reprendre, À suivre) en rose. Le film ouvert reste focalisable, inerte.
 *
 * Contrat : `useSagaView` → `buildSagaView` (ordre, rangs, mentions),
 * `sagaTitle` / `sagaSummary` / `sagaLabel`. Les volets absents viennent des
 * extensions (`useExternalCollection`) ou, sans elles, des `parts` de TMDB.
 * Groupe de focus : `detail:saga` ; éléments `saga:<i>`.
 */

const { width: W, radius: R } = TV_STAGE.card.poster;
const H = Math.round(W * 1.5);
const SHIFT = H * (TV_STAGE.focus.cardScale - 1);

function MissingPoster({ title, year, focused, place }: { title: string; year?: string; focused: boolean; place: RowPlace }) {
  const { t } = useTranslation();
  return (
    <CardFrame width={W} height={H} radius={R} focused={focused} place={place}>
      <LinearGradient colors={[white(0.1), white(0.03)]} style={[StyleSheet.absoluteFill, styles.missing]}>
        <Icon name="film" size={34} color={white(0.42)} />
        <View style={styles.missingText}>
          <Text style={styles.missingTitle} numberOfLines={4}>{title}</Text>
          {year ? <Text style={styles.missingYear}>{year}</Text> : null}
          <Text style={styles.missingNote} numberOfLines={2}>{t("search:externalFallback")}</Text>
        </View>
      </LinearGradient>
    </CardFrame>
  );
}

function Caption({ entry, focused, hold = false }: { entry: SagaEntryModel; focused: boolean; hold?: boolean }) {
  const p = useFocusProgress(focused);
  const shift = useAnimatedStyle(() => ({ transform: [{ translateY: SHIFT * p.value }] }));
  const title = entry.card?.title ?? entry.missing?.title ?? "";
  const rank = entry.rank ?? null;
  const cue = entry.cue ?? null;
  return (
    <Animated.View style={[styles.caption, shift]}>
      <Text style={[styles.title, focused && styles.titleFocused]} numberOfLines={1}>{title}</Text>
      <Text style={styles.label} numberOfLines={1}>
        {rank}
        {rank && cue ? " · " : ""}
        {cue ? <Text style={styles.cue}>{cue}</Text> : null}
      </Text>
      <CardFocusFooter hold={hold} width={Math.round(W * 1.6)} />
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
 * Un volet. L'affiche d'un volet de la bibliothèque (`MediaCard`) garde son
 * focus pour elle : le volet le suit dans SON état, pour sa légende — un pas
 * du focus ne redessine que les deux volets qu'il quitte et qu'il atteint,
 * jamais la rangée (le recul des voisins passe par `row`).
 */
const SagaEntry = memo(function SagaEntry({ entry, index, row, onItemFocusChange, onOpen, onLongPress, onFocusChange }: SagaEntryProps) {
  const [native, setNative] = useState(false);
  const forced = useForcedFocusKey();
  const focused = forced !== null ? cardIndexOf(forced, "saga") === index : native;
  const place = useMemo(() => ({ row, index }), [row, index]);
  const tracksFocus = entry.card !== undefined;
  const focusChange = useCallback(
    (next: boolean) => {
      if (tracksFocus) setNative(next);
      onItemFocusChange(index, next);
      onFocusChange?.(next);
    },
    [tracksFocus, index, onItemFocusChange, onFocusChange],
  );
  const press = onOpen && !entry.current ? () => onOpen(entry) : undefined;
  if (entry.card) {
    return (
      <View style={{ width: W }}>
        <MediaCard
          card={entry.card}
          variant="poster"
          hideCaption
          place={place}
          focusKey={`saga:${index}`}
          onPress={press}
          onLongPress={onLongPress ? () => onLongPress(entry) : undefined}
          onFocusChange={focusChange}
        />
        <Caption entry={entry} focused={focused} hold={focused && onLongPress !== undefined} />
      </View>
    );
  }
  return (
    <FocusTarget focusKey={`saga:${index}`} onPress={press} onFocusChange={focusChange} accessibilityLabel={entry.missing?.title} style={{ width: W }}>
      {(targetFocused) => (
        <View>
          <MissingPoster title={entry.missing?.title ?? ""} year={entry.missing?.year} focused={targetFocused} place={place} />
          <Caption entry={entry} focused={targetFocused} />
        </View>
      )}
    </FocusTarget>
  );
});

export const SagaRow = memo(function SagaRow({
  entries,
  onOpen,
  onLongPress,
  onFocusChange,
}: {
  entries: SagaEntryModel[];
  onOpen?: (entry: SagaEntryModel) => void;
  onLongPress?: (entry: SagaEntryModel) => void;
  onFocusChange?: (focused: boolean) => void;
}) {
  const forced = useForcedFocusKey();
  const { row, onItemFocusChange } = useRowFocus(forced !== null, forced !== null ? cardIndexOf(forced, "saga") : null);
  return (
    <FocusGroup focusKey="detail:saga">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.track} contentContainerStyle={styles.content}>
        {entries.map((entry, index) => (
          <SagaEntry
            key={entry.key}
            entry={entry}
            index={index}
            row={row}
            onItemFocusChange={onItemFocusChange}
            onOpen={onOpen}
            onLongPress={onLongPress}
            onFocusChange={onFocusChange}
          />
        ))}
      </ScrollView>
    </FocusGroup>
  );
});

const styles = StyleSheet.create({
  track: { overflow: "visible" },
  content: { gap: TV_STAGE.row.gap, paddingLeft: DETAIL_LEFT, paddingRight: TV_STAGE.safe.x, paddingTop: 12, paddingBottom: 24 },
  missing: { padding: 22, justifyContent: "space-between" },
  missingText: { gap: 6 },
  missingTitle: { ...fonts.bold, fontSize: 26, lineHeight: 31, color: white(0.78) },
  missingYear: { ...fonts.medium, fontSize: 22, color: colors.textSecondary },
  missingNote: { ...fonts.semibold, fontSize: 22, color: colors.textTertiary, marginTop: 6 },
  caption: { marginTop: 16, gap: 2 },
  title: { ...fonts.semibold, fontSize: 24, color: colors.textSecondary },
  titleFocused: { color: colors.text },
  label: { ...fonts.medium, fontSize: 22, color: colors.textTertiary },
  cue: { ...fonts.semibold, fontSize: 22, color: colors.accentLight },
});
