import { memo, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import { ctlGradient, FONT_FAMILY, motion, RADIUS, spacing, useTheme, useThemedStyles, type AppTheme } from "@/theme";

export interface CapsuleItem {
  id: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
}

const PAD = 4;
const HEIGHT = 48;
/** Au-delà, la capsule défile : des segments de largeur fixe. */
const MAX_EVEN = 4;
const SCROLL_SEGMENT = 128;
/** Le ressort de l'indicateur des onglets (`useSlidingIndicator`) : même geste, même physique. */
const SPRING = { damping: 28, stiffness: 320, mass: 0.8 };

/**
 * La capsule des bibliothèques — la barre du bureau 1.22.0 (« un onglet par
 * bibliothèque, plus de menu à ouvrir pour atteindre Films ») à l'échelle du
 * pouce. Un calque de dégradé de marque glisse sur ressort sous la
 * bibliothèque choisie : seule une translation s'anime, rien ne se repeint.
 * Mouvement réduit : il se pose, sans glisser.
 */
export const LibraryCapsule = memo(function LibraryCapsule({ items, selected, onSelect, accessibilityLabel }: {
  items: CapsuleItem[];
  selected: string;
  onSelect: (id: string) => void;
  accessibilityLabel: string;
}) {
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const gradient = ctlGradient(theme.colors.brand);
  const [width, setWidth] = useState(0);
  const scrolls = items.length > MAX_EVEN;
  const segment = scrolls ? SCROLL_SEGMENT : width > 0 ? (width - PAD * 2) / items.length : 0;
  const index = Math.max(0, items.findIndex((item) => item.id === selected));

  const x = useSharedValue(0);
  const placed = useRef(false);
  useEffect(() => {
    if (segment === 0) return;
    const target = index * segment;
    if (!placed.current || motion.isReducedMotion()) {
      x.value = target;
      placed.current = true;
    } else {
      x.value = withSpring(target, SPRING);
    }
  }, [index, segment, x]);
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  const choose = (id: string) => {
    if (id === selected) return;
    void Haptics.selectionAsync().catch(() => {});
    onSelect(id);
  };

  const row = (
    <View style={[st.row, scrolls && { width: segment * items.length }]}>
      {segment > 0 && (
        <Animated.View style={[st.pill, { width: segment }, pill]} pointerEvents="none">
          <LinearGradient colors={gradient.colors} locations={gradient.locations} start={gradient.start} end={gradient.end} style={StyleSheet.absoluteFill} />
        </Animated.View>
      )}
      {items.map((item) => {
        const active = item.id === selected;
        return (
          <Pressable
            key={item.id}
            onPress={() => choose(item.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={item.label}
            style={[st.segment, { width: segment || undefined }, segment === 0 && st.segmentFlex]}
          >
            <Feather name={item.icon} size={15} color={active ? theme.colors.cta.brandFg : theme.colors.text.secondary} />
            <Text style={[st.label, active && { color: theme.colors.cta.brandFg }]} numberOfLines={1}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <View
      style={st.capsule}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
    >
      {scrolls ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.scroll}>{row}</ScrollView>
      ) : row}
    </View>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    capsule: {
      height: HEIGHT,
      marginHorizontal: spacing.screenPadding,
      padding: PAD,
      borderRadius: RADIUS.pill,
      borderWidth: 1,
      borderColor: t.colors.border.strong,
      backgroundColor: t.colors.surface.s1,
      overflow: "hidden" as const,
    },
    scroll: { alignItems: "center" as const },
    row: { flex: 1, flexDirection: "row" as const, alignItems: "stretch" as const },
    pill: { position: "absolute" as const, top: 0, bottom: 0, left: 0, borderRadius: RADIUS.pill, overflow: "hidden" as const },
    segment: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, gap: 7, paddingHorizontal: 8 },
    segmentFlex: { flex: 1 },
    label: { flexShrink: 1, fontSize: 14, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.secondary, letterSpacing: 0.1 },
  });
