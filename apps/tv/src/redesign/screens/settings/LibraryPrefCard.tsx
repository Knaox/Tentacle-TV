import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { PillButton } from "../../controls/PillButton";
import { FocusTarget } from "../../focus/FocusTarget";
import { useFocusProgress } from "../../focus/useFocusProgress";
import { GlassSurface } from "../../glass/GlassSurface";
import { Icon } from "../../icons/Icon";
import { colors, fonts, scrim, white } from "../../theme/tokens";
import type { LibraryPrefModel, LibrarySettingKey } from "./settingsTypes";

/**
 * Les pistes par défaut d'UNE bibliothèque : trois tuiles qui disent ce
 * qu'elles règlent et où elles en sont (« AUDIO — Japonais ») ; OK ouvre la
 * grande liste de choix. « Réinitialiser » ne paraît que si une préférence
 * existe. Branchement : `useLibraries`, `useLibraryPreferences`,
 * `useSetLibraryPreference`, `useDeleteLibraryPreference`.
 */

const KEYS: LibrarySettingKey[] = ["audio", "subtitleMode", "subtitles"];

/** Clé i18n (`preferences`) du nom de chaque réglage. */
export const LIBRARY_SETTING_LABEL_KEYS: Record<LibrarySettingKey, string> = {
  audio: "audio",
  subtitleMode: "subtitleMode",
  subtitles: "subtitles",
};

export const LibraryPrefCard = memo(function LibraryPrefCard({ library, focusPrefix, onOpen, onReset }: {
  library: LibraryPrefModel;
  /** Préfixe des clés de focus du banc (`settings:lib:0`). */
  focusPrefix: string;
  onOpen?: (key: LibrarySettingKey) => void;
  onReset?: () => void;
}) {
  const { t } = useTranslation("preferences");
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.name} numberOfLines={1}>{library.name}</Text>
        {library.customized ? (
          <PillButton
            label={t("reset")}
            icon="replay"
            size="md"
            focusKey={`${focusPrefix}:reset`}
            onPress={onReset}
          />
        ) : null}
      </View>
      <View style={styles.tiles}>
        {KEYS.map((key) => (
          <ValueTile
            key={key}
            label={t(LIBRARY_SETTING_LABEL_KEYS[key])}
            value={library.values[key]}
            focusKey={`${focusPrefix}:${key}`}
            onPress={onOpen ? () => onOpen(key) : undefined}
          />
        ))}
      </View>
    </View>
  );
});

const TILE_RADIUS = 24;

function ValueTile({ label, value, focusKey, onPress }: { label: string; value: string; focusKey: string; onPress?: () => void }) {
  return (
    <FocusTarget focusKey={focusKey} form="row" onPress={onPress} accessibilityLabel={`${label} : ${value}`} style={styles.tileSlot}>
      {(focused) => <TileBody label={label} value={value} focused={focused} />}
    </FocusTarget>
  );
}

function TileContent({ label, value, dark }: { label: string; value: string; dark: boolean }) {
  return (
    <View style={styles.tileRow}>
      <View style={styles.tileTexts}>
        <Text style={[styles.tileLabel, { color: dark ? scrim(0.55) : colors.textTertiary }]} numberOfLines={1}>{label}</Text>
        <Text
          style={[styles.tileValue, { color: dark ? colors.ctaFg : colors.text }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
          {value}
        </Text>
      </View>
      <Icon name="chevronRight" size={26} color={dark ? colors.ctaFg : colors.textTertiary} strokeWidth={2.4} />
    </View>
  );
}

function TileBody({ label, value, focused }: { label: string; value: string; focused: boolean }) {
  const p = useFocusProgress(focused);
  const lift = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.05 * p.value }] }));
  const onLayer = useAnimatedStyle(() => ({ opacity: p.value }));
  const offLayer = useAnimatedStyle(() => ({ opacity: 1 - p.value }));
  return (
    <Animated.View style={lift}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.shadow, onLayer]} />
      <Animated.View style={[StyleSheet.absoluteFill, offLayer]}>
        <GlassSurface radius={TILE_RADIUS} tone="clear" style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View style={offLayer}>
        <TileContent label={label} value={value} dark={false} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, styles.focusFill, onLayer]}>
        <TileContent label={label} value={value} dark />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 32,
    padding: 28,
    gap: 22,
    backgroundColor: white(0.035),
    borderWidth: 1,
    borderColor: white(0.08),
  },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 56 },
  name: { ...fonts.bold, fontSize: 32, lineHeight: 40, color: colors.text, flexShrink: 1 },
  tiles: { flexDirection: "row", gap: 18 },
  tileSlot: { flex: 1 },
  tileRow: { height: 108, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 26 },
  tileTexts: { flex: 1, gap: 6 },
  tileLabel: { ...fonts.bold, fontSize: 22, lineHeight: 28, letterSpacing: 1.6, textTransform: "uppercase" },
  tileValue: { ...fonts.semibold, fontSize: 28, lineHeight: 36 },
  focusFill: { borderRadius: TILE_RADIUS, backgroundColor: colors.ctaBg },
  shadow: {
    borderRadius: TILE_RADIUS,
    backgroundColor: "#000",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.5,
    shadowRadius: 22,
  },
});
