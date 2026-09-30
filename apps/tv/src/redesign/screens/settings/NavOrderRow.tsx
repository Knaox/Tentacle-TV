import { memo, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { FocusTarget } from "../../focus/FocusTarget";
import { useFocusProgress } from "../../focus/useFocusProgress";
import { GlassSurface } from "../../glass/GlassSurface";
import { Icon } from "../../icons/Icon";
import { colors, fonts, scrim } from "../../theme/tokens";
import type { NavigationSettingsEntry } from "./settingsTypes";

/**
 * Une ligne du réglage « Navigation » : l'entrée, et à droite sa visibilité.
 *
 * - la ligne elle-même (sa place, son pictogramme, son nom) : OK la SOULÈVE
 *   — elle prend le liseré de la marque et la flèche double ; HAUT / BAS la
 *   déplacent, OK la pose. Au focus, elle dit « OK : déplacer » ;
 * - la pastille de droite : « Affichée » / « Masquée », OK bascule. Une
 *   entrée masquée garde sa place dans la liste, estompée.
 *
 * Clés de focus : `settings:nav:<i>` (la ligne) et `settings:nav:<i>:visibility`
 * — par POSITION : une entrée déplacée change de case, pas de cible.
 */

const HEIGHT = 84;
const RADIUS = 26;
const VISIBILITY_WIDTH = 230;

export const NavOrderRow = memo(function NavOrderRow({ index, entry, moving, onMove, onToggle }: {
  index: number;
  entry: NavigationSettingsEntry;
  moving: boolean;
  onMove?: (key: string) => void;
  onToggle?: (key: string) => void;
}) {
  const { t } = useTranslation("preferences");
  const state = entry.hidden ? t("navigationHidden") : t("navigationShown");
  return (
    <View style={styles.line}>
      <FocusTarget
        focusKey={`settings:nav:${index}`}
        onPress={onMove ? () => onMove(entry.key) : undefined}
        accessibilityLabel={`${index + 1}. ${entry.label}, ${state}`}
        style={styles.main}
      >
        {(focused) => <MainBody index={index} entry={entry} moving={moving} focused={focused} />}
      </FocusTarget>
      <FocusTarget
        focusKey={`settings:nav:${index}:visibility`}
        onPress={onToggle ? () => onToggle(entry.key) : undefined}
        accessibilityLabel={`${entry.label} : ${state}`}
      >
        {(focused) => <VisibilityBody hidden={entry.hidden} label={state} focused={focused} />}
      </FocusTarget>
    </View>
  );
});

function Surface({ focused, moving, children }: { focused: boolean; moving?: boolean; children: (dark: boolean) => ReactNode }) {
  const p = useFocusProgress(focused);
  const lift = useAnimatedStyle(() => ({ transform: [{ scale: 1 + (moving ? 0.03 : 0.02) * p.value }] }));
  const onLayer = useAnimatedStyle(() => ({ opacity: p.value }));
  const offLayer = useAnimatedStyle(() => ({ opacity: 1 - p.value }));
  return (
    <Animated.View style={[styles.surface, lift]}>
      <Animated.View style={[StyleSheet.absoluteFill, offLayer]}>
        <GlassSurface radius={RADIUS} tone="clear" style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View style={offLayer}>{children(false)}</Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, styles.focusFill, onLayer]}>{children(true)}</Animated.View>
      {moving ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.ring]} /> : null}
    </Animated.View>
  );
}

function MainBody({ index, entry, moving, focused }: { index: number; entry: NavigationSettingsEntry; moving: boolean; focused: boolean }) {
  const { t } = useTranslation("preferences");
  return (
    <Surface focused={focused} moving={moving}>
      {(dark) => {
        const main = dark ? colors.ctaFg : entry.hidden ? colors.textTertiary : colors.text;
        const soft = dark ? scrim(0.55) : colors.textTertiary;
        return (
          <View style={styles.row}>
            <Text style={[styles.position, { color: soft }]}>{index + 1}</Text>
            <Icon name={moving ? "moveVertical" : entry.icon} size={30} color={main} strokeWidth={2.2} />
            <Text style={[styles.label, { color: main }]} numberOfLines={1}>
              {entry.label}
            </Text>
            {dark || moving ? (
              <Text style={[styles.hint, { color: soft }]} numberOfLines={1}>
                {moving ? t("navigationMovingHint") : t("navigationMoveHint")}
              </Text>
            ) : null}
          </View>
        );
      }}
    </Surface>
  );
}

function VisibilityBody({ hidden, label, focused }: { hidden: boolean; label: string; focused: boolean }) {
  return (
    <View style={styles.visibility}>
      <Surface focused={focused}>
        {(dark) => {
          const color = dark ? colors.ctaFg : hidden ? colors.textTertiary : colors.text;
          return (
            <View style={[styles.row, styles.visibilityRow]}>
              <Icon name={hidden ? "eyeOff" : "eye"} size={28} color={color} strokeWidth={2.2} />
              <Text style={[styles.state, { color }]} numberOfLines={1}>
                {label}
              </Text>
            </View>
          );
        }}
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: "row", alignItems: "center", gap: 16 },
  main: { flex: 1 },
  surface: { height: HEIGHT, borderRadius: RADIUS },
  row: { height: HEIGHT, flexDirection: "row", alignItems: "center", gap: 22, paddingHorizontal: 28 },
  position: { ...fonts.semibold, fontSize: 24, width: 34, textAlign: "right", fontVariant: ["tabular-nums"] },
  label: { ...fonts.semibold, fontSize: 28, flex: 1 },
  hint: { ...fonts.medium, fontSize: 22 },
  visibility: { width: VISIBILITY_WIDTH },
  visibilityRow: { gap: 14, justifyContent: "center" },
  state: { ...fonts.semibold, fontSize: 24 },
  focusFill: { borderRadius: RADIUS, backgroundColor: colors.ctaBg },
  ring: { borderRadius: RADIUS, borderWidth: 2, borderColor: colors.accent },
});
