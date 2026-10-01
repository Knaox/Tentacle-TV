import { memo, useCallback, useMemo } from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { TV_STAGE } from "@tentacle-tv/theme";
import { CardFrame } from "../../cards/CardFrame";
import { CardShell } from "../../cards/CardShell";
import { useCardFocused } from "../../cards/useCardFocused";
import { FocusGroup } from "../../focus/FocusGroup";
import { useForcedFocusKey } from "../../focus/focusPreview";
import { useFocusProgress } from "../../focus/useFocusProgress";
import { Icon } from "../../icons/Icon";
import { useRowFocus } from "../../motion/useRowRecede";
import { colors, fonts, scrim, white } from "../../theme/tokens";
import { DETAIL_LEFT } from "./DetailSection";
import type { ExtraModel } from "./detailTypes";

/**
 * Les extras : bandes-annonces locales, bonus, vidéos distantes — dans
 * l'ordre de toutes les plateformes (`buildExtraEntries`). Vignettes 16:9,
 * le titre et le genre dessous. Une vidéo retirée reste à sa place, grisée,
 * « Indisponible ».
 *
 * Contrat : `useItemExtras` (locaux), `useRemoteTrailers` (distants),
 * `buildExtraEntries` (l'ordre, les libellés), `seasonHasExtras` (saisons).
 * Groupe de focus : `detail:extras` ; éléments `extra:<i>`.
 */

const { width: W, height: H, radius: R } = TV_STAGE.card.landscape;
const SHIFT = H * (TV_STAGE.focus.cardScale - 1);

function Caption({ extra, focused }: { extra: ExtraModel; focused: boolean }) {
  const { t } = useTranslation();
  const p = useFocusProgress(focused);
  const shift = useAnimatedStyle(() => ({ transform: [{ translateY: SHIFT * p.value }] }));
  return (
    <Animated.View style={[styles.caption, shift]}>
      <Text style={[styles.title, focused && styles.titleFocused]} numberOfLines={1}>{extra.title}</Text>
      <Text style={styles.subtitle} numberOfLines={1}>
        {extra.unavailable ? t("common:trailerUnavailableShort") : extra.subtitle ?? ""}
      </Text>
    </Animated.View>
  );
}

/** Un extra : la vignette suit le pouce, sa légende reste droite (`CardShell`). */
const ExtraCell = memo(function ExtraCell({
  extra,
  index,
  row,
  onOpen,
  onItemFocusChange,
  onFocusChange,
}: {
  extra: ExtraModel;
  index: number;
  row: SharedValue<number>;
  onOpen?: (extra: ExtraModel) => void;
  onItemFocusChange: (index: number, focused: boolean) => void;
  onFocusChange?: (focused: boolean) => void;
}) {
  const focusKey = `extra:${index}`;
  const report = useCallback(
    (focused: boolean) => {
      onItemFocusChange(index, focused);
      onFocusChange?.(focused);
    },
    [index, onItemFocusChange, onFocusChange],
  );
  const { focused, onTargetFocusChange } = useCardFocused(focusKey, report);
  const place = useMemo(() => ({ row, index }), [row, index]);
  return (
    <CardShell
      focusKey={focusKey}
      width={W}
      frameHeight={H}
      onPress={onOpen && !extra.unavailable ? () => onOpen(extra) : undefined}
      onTargetFocusChange={onTargetFocusChange}
      accessibilityLabel={extra.title}
      frame={
        <CardFrame width={W} height={H} radius={R} focused={focused} place={place}>
          {extra.imageUri ? (
            <Image source={{ uri: extra.imageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" fadeDuration={0} />
          ) : (
            <View style={styles.missing}>
              <Icon name="trailer" size={44} color={white(0.3)} />
            </View>
          )}
          {extra.unavailable ? (
            <View style={[StyleSheet.absoluteFill, styles.unavailable]}>
              <Icon name="eyeOff" size={40} color={white(0.7)} />
            </View>
          ) : null}
        </CardFrame>
      }
    >
      <Caption extra={extra} focused={focused} />
    </CardShell>
  );
});

export const ExtrasRow = memo(function ExtrasRow({
  extras,
  onOpen,
  onFocusChange,
}: {
  extras: ExtraModel[];
  onOpen?: (extra: ExtraModel) => void;
  onFocusChange?: (focused: boolean) => void;
}) {
  const forced = useForcedFocusKey();
  const forcedIndex = forced?.startsWith("extra:") ? Number(forced.slice(6)) : null;
  const { row, onItemFocusChange } = useRowFocus(forced !== null, forcedIndex);
  return (
    <FocusGroup focusKey="detail:extras">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.track} contentContainerStyle={styles.content}>
        {extras.map((extra, index) => (
          <ExtraCell
            key={extra.id}
            extra={extra}
            index={index}
            row={row}
            onOpen={onOpen}
            onItemFocusChange={onItemFocusChange}
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
  missing: { flex: 1, justifyContent: "flex-end", padding: 20, backgroundColor: colors.surface3 },
  unavailable: { alignItems: "flex-end", justifyContent: "flex-start", padding: 16, backgroundColor: scrim(0.62) },
  caption: { marginTop: 16, gap: 2 },
  title: { ...fonts.semibold, fontSize: 24, color: colors.textSecondary },
  titleFocused: { color: colors.text },
  subtitle: { ...fonts.medium, fontSize: 22, color: colors.textTertiary },
});
