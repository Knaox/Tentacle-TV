import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { FocusTarget } from "../../focus/FocusTarget";
import { useFocusProgress } from "../../focus/useFocusProgress";
import { Icon, type IconName } from "../../icons/Icon";
import { colors, fonts, scrim, white } from "../../theme/tokens";
import type { SettingsTab } from "./settingsTypes";

/**
 * Les onglets des réglages, en colonne : un pictogramme, le nom de l'onglet
 * et, dessous, ce qu'il règle en ce moment (« Knaoxtest », « Par défaut ») —
 * on lit l'état sans ouvrir. L'onglet affiché porte le verre allumé de la
 * navigation ; celui qui a le focus devient blanc, texte noir.
 */

export interface SettingsTabItem {
  key: SettingsTab;
  label: string;
  caption?: string;
  icon: IconName;
}

export const TAB_WIDTH = 340;
const HEIGHT = 100;
const RADIUS = 28;

export const SettingsTabs = memo(function SettingsTabs({ items, active, onSelect }: {
  items: SettingsTabItem[];
  active: SettingsTab;
  onSelect?: (tab: SettingsTab) => void;
}) {
  return (
    <View style={styles.column}>
      {items.map((item) => (
        <FocusTarget
          key={item.key}
          focusKey={`settings:tab:${item.key}`}
          onPress={onSelect ? () => onSelect(item.key) : undefined}
          accessibilityLabel={item.label}
        >
          {(focused) => <TabBody item={item} active={item.key === active} focused={focused} />}
        </FocusTarget>
      ))}
    </View>
  );
});

function Content({ item, active, dark }: { item: SettingsTabItem; active: boolean; dark: boolean }) {
  const color = dark ? colors.ctaFg : active ? colors.text : colors.textSecondary;
  return (
    <View style={styles.row}>
      <Icon name={item.icon} size={32} color={color} strokeWidth={dark || active ? 2.4 : 2} />
      <View style={styles.texts}>
        <Text style={[dark || active ? styles.labelActive : styles.label, { color }]} numberOfLines={1}>
          {item.label}
        </Text>
        {item.caption ? (
          <Text style={[styles.caption, { color: dark ? scrim(0.6) : colors.textTertiary }]} numberOfLines={1}>
            {item.caption}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function TabBody({ item, active, focused }: { item: SettingsTabItem; active: boolean; focused: boolean }) {
  const p = useFocusProgress(focused);
  const lift = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.045 * p.value }] }));
  const layer = useAnimatedStyle(() => ({ opacity: p.value }));
  return (
    <Animated.View style={[styles.item, lift]}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.shadow, layer]} />
      {active ? <View style={[StyleSheet.absoluteFill, styles.activeGlass]} /> : null}
      <Content item={item} active={active} dark={false} />
      <Animated.View style={[StyleSheet.absoluteFill, styles.focusFill, layer]}>
        <Content item={item} active={active} dark />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  column: { width: TAB_WIDTH, gap: 14 },
  item: { width: TAB_WIDTH, height: HEIGHT, borderRadius: RADIUS },
  row: { height: HEIGHT, flexDirection: "row", alignItems: "center", gap: 22, paddingHorizontal: 28 },
  texts: { flex: 1, gap: 2 },
  label: { ...fonts.semibold, fontSize: 30, lineHeight: 38 },
  labelActive: { ...fonts.bold, fontSize: 30, lineHeight: 38 },
  caption: { ...fonts.medium, fontSize: 22, lineHeight: 28 },
  activeGlass: { borderRadius: RADIUS, backgroundColor: white(0.16), borderWidth: 1, borderColor: white(0.16) },
  focusFill: { borderRadius: RADIUS, backgroundColor: colors.ctaBg },
  shadow: {
    borderRadius: RADIUS,
    backgroundColor: "#000",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
  },
});
