import { memo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { TV_STAGE } from "@tentacle-tv/theme";
import { CardFrame } from "../../cards/CardFrame";
import { cardIndexOf } from "../../cards/cardFocusKeys";
import { MediaCard } from "../../cards/MediaCard";
import { FocusGroup } from "../../focus/FocusGroup";
import { FocusTarget } from "../../focus/FocusTarget";
import { useForcedFocusKey } from "../../focus/focusPreview";
import { useFocusProgress } from "../../focus/useFocusProgress";
import { Icon } from "../../icons/Icon";
import { colors, fonts, white } from "../../theme/tokens";
import { DETAIL_LEFT } from "./DetailSection";
import type { SagaEntryModel } from "./detailTypes";

/**
 * La saga d'un film, dans l'ordre de TMDB : les affiches des volets de la
 * bibliothèque (leurs marqueurs), et à leur rang ceux qui manquent — un
 * cadre sans image, leur titre et leur année écrits dedans. Sous chaque
 * carte, le titre puis « Volet 2 · Cette fiche », la mention (Cette fiche,
 * Reprendre, À suivre) en ambre. Le film ouvert reste focalisable, inerte.
 *
 * Contrat : `useSagaView` → `buildSagaView` (ordre, rangs, mentions),
 * `sagaTitle` / `sagaSummary` / `sagaLabel`. Les volets absents viennent des
 * extensions (`useExternalCollection`) ou, sans elles, des `parts` de TMDB.
 * Groupe de focus : `detail:saga` ; éléments `saga:<i>`.
 */

const { width: W, radius: R } = TV_STAGE.card.poster;
const H = Math.round(W * 1.5);
const SHIFT = H * (TV_STAGE.focus.cardScale - 1);

function MissingPoster({ title, year, focused, dimmed }: { title: string; year?: string; focused: boolean; dimmed: boolean }) {
  const { t } = useTranslation();
  return (
    <CardFrame width={W} height={H} radius={R} focused={focused} dimmed={dimmed}>
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

function Caption({ entry, focused }: { entry: SagaEntryModel; focused: boolean }) {
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
    </Animated.View>
  );
}

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
  const [nativeIndex, setNativeIndex] = useState<number | null>(null);
  const forced = useForcedFocusKey();
  // Le volet, ou un bouton de son plateau (`saga:<n>:tray:…`).
  const focusedIndex = forced !== null ? cardIndexOf(forced, "saga") : nativeIndex;
  const focusChange = (index: number) => (focused: boolean) => {
    setNativeIndex((current) => (focused ? index : current === index ? null : current));
    onFocusChange?.(focused);
  };
  return (
    <FocusGroup focusKey="detail:saga">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.track} contentContainerStyle={styles.content}>
        {entries.map((entry, index) => {
          const dimmed = focusedIndex !== null && focusedIndex !== index;
          const press = onOpen && !entry.current ? () => onOpen(entry) : undefined;
          return entry.card ? (
            <View key={entry.key} style={{ width: W }}>
              <MediaCard
                card={entry.card}
                variant="poster"
                hideCaption
                dimmed={dimmed}
                focusKey={`saga:${index}`}
                onPress={press}
                onLongPress={onLongPress ? () => onLongPress(entry) : undefined}
                onFocusChange={focusChange(index)}
              />
              {/* `MediaCard` garde son focus pour elle : la rangée le suit, la légende aussi. */}
              <Caption entry={entry} focused={focusedIndex === index} />
            </View>
          ) : (
            <FocusTarget key={entry.key} focusKey={`saga:${index}`} onPress={press} onFocusChange={focusChange(index)} accessibilityLabel={entry.missing?.title} style={{ width: W }}>
              {(focused) => (
                <View>
                  <MissingPoster title={entry.missing?.title ?? ""} year={entry.missing?.year} focused={focused} dimmed={dimmed} />
                  <Caption entry={entry} focused={focused} />
                </View>
              )}
            </FocusTarget>
          );
        })}
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
