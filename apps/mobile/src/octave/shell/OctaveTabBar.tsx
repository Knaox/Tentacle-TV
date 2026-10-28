/**
 * Octave (mobile, téléphone) — la barre d'onglets en VERRE qui flotte au-dessus
 * des pages, comme celle d'iOS 26 : une pilule (Accueil · Rechercher ·
 * Bibliothèque) où une pastille rose glisse d'un onglet à l'autre (ressort,
 * mouvement réduit respecté), et à côté un rond de verre pour revenir aux films
 * et séries. Persistante : elle reste sur les pages empilées (album, artiste…),
 * l'onglet d'origine allumé. Libellés toujours visibles, cibles ≥ 44 pt.
 */

import { memo, useEffect, useState } from "react";
import { Keyboard, Platform, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { Clapperboard } from "lucide-react-native";
import { OCTAVE_TABS } from "@tentacle-tv/shared/octave/mode";
import { OctaveGlass } from "../layout/OctaveGlass";
import { useOctaveColors } from "../theme/octaveColors";
import { useLeaveOctave } from "../mode/useOctaveSwitch";
import { OCTAVE_NAV_ITEMS } from "./octaveNavItems";
import { useOctaveTab } from "./useOctaveTab";

export const TAB_BAR_PILL_HEIGHT = 62;
const MIN_BOTTOM = 10;
const RIPPLE = { borderless: true, radius: 36, color: "rgba(255,255,255,0.12)" } as const;
const SPRING = { damping: 22, stiffness: 260, mass: 0.9, reduceMotion: ReduceMotion.System } as const;

/**
 * Android redimensionne la fenêtre sous le clavier : la barre flotterait sur
 * lui pendant une recherche. Elle s'efface le temps du clavier (iOS : le clavier
 * la recouvre déjà).
 */
function useAndroidKeyboardShown(): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const show = Keyboard.addListener("keyboardDidShow", () => setShown(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setShown(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return shown;
}

/** Hauteur occupée par la barre, zone sûre comprise. */
export function useOctaveTabBarHeight(): number {
  return TAB_BAR_PILL_HEIGHT + Math.max(useSafeAreaInsets().bottom, MIN_BOTTOM);
}

export const OctaveTabBar = memo(function OctaveTabBar() {
  const insets = useSafeAreaInsets();
  const colors = useOctaveColors();
  const { t } = useTranslation("music");
  const { t: ts } = useTranslation("octaveShell");
  const { active, go } = useOctaveTab();
  const leave = useLeaveOctave();
  const itemWidth = useSharedValue(0);
  const index = OCTAVE_TABS.indexOf(active);
  const offset = useSharedValue(index);
  useEffect(() => {
    offset.value = withSpring(index, SPRING);
  }, [index, offset]);
  const indicator = useAnimatedStyle(() => ({ width: itemWidth.value, transform: [{ translateX: offset.value * itemWidth.value }] }));
  const onRowLayout = (e: LayoutChangeEvent) => {
    itemWidth.value = (e.nativeEvent.layout.width - 8) / OCTAVE_TABS.length;
  };
  if (useAndroidKeyboardShown()) return null;

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, MIN_BOTTOM) }]}>
      <OctaveGlass radius={TAB_BAR_PILL_HEIGHT / 2} style={styles.pill} interactive>
        <View style={styles.row} onLayout={onRowLayout} accessibilityRole="tablist">
          <Animated.View pointerEvents="none" style={[styles.indicator, { backgroundColor: colors.accentSoft }, indicator]} />
          {OCTAVE_NAV_ITEMS.map(({ tab, labelKey, Icon }) => {
            const selected = tab === active;
            const tint = selected ? colors.accentText : colors.textSecondary;
            return (
              <Pressable
                key={tab}
                onPress={() => go(tab)}
                android_ripple={RIPPLE}
                style={styles.item}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={t(labelKey)}
              >
                <Icon size={22} color={tint} strokeWidth={selected ? 2.4 : 2} />
                <Text style={[styles.label, { color: tint, fontWeight: selected ? "700" : "500" }]} numberOfLines={1}>
                  {t(labelKey)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </OctaveGlass>
      <OctaveGlass radius={TAB_BAR_PILL_HEIGHT / 2} style={styles.exit} interactive>
        <Pressable
          onPress={leave}
          android_ripple={RIPPLE}
          style={styles.exitHit}
          accessibilityRole="button"
          accessibilityLabel={ts("backToFilms.label")}
          accessibilityHint={ts("backToFilms.hint")}
        >
          <Clapperboard size={22} color={colors.textSecondary} strokeWidth={2} />
        </Pressable>
      </OctaveGlass>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", gap: 10, paddingHorizontal: 16 },
  pill: { flex: 1, height: TAB_BAR_PILL_HEIGHT },
  row: { flex: 1, flexDirection: "row", padding: 4 },
  indicator: { position: "absolute", top: 4, bottom: 4, left: 4, borderRadius: (TAB_BAR_PILL_HEIGHT - 8) / 2 },
  item: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3, minHeight: 44 },
  label: { fontSize: 11, letterSpacing: 0.1 },
  exit: { width: TAB_BAR_PILL_HEIGHT, height: TAB_BAR_PILL_HEIGHT },
  exitHit: { flex: 1, alignItems: "center", justifyContent: "center" },
});
