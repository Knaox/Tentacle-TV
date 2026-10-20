import { memo, useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { spacing, typography, FONT_FAMILY, motion, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { selectedOptionLook } from "@/components/ui/buttons";
import type { ChoiceOption } from "./SegmentedChoice";

interface Props {
  options: ChoiceOption[];
  value: string;
  onChange: (value: string) => void;
  /** Le nom du réglage : les pastilles seules ne disent pas ce qu'elles choisissent. */
  accessibilityLabel: string;
}

const SWAP_MS = 160;
const HEIGHT = 38;
/** 38 pt dessinés, 46 pt touchés. */
const HIT_SLOP = { top: 4, bottom: 4, left: 2, right: 2 } as const;

/**
 * Un choix parmi quelques mots courts (langue, densité, durée) : des
 * PASTILLES, comme les réglages de l'Apple TV — celle qui est retenue porte
 * la coche et le pouce NEUTRE du système de boutons (`selectedOptionLook` ;
 * plus le dégradé de marque depuis le 20/10), les autres restent en verre
 * discret. Elles passent à la ligne plutôt que de couper un mot. Le pouce est
 * un calque présent sur chaque pastille, à opacité nulle hors du choix : passer
 * de l'une à l'autre est un fondu croisé, jamais un fond conditionnel (que
 * Fabric Android rend sans rayon).
 */
export const ChoiceChips = memo(function ChoiceChips({ options, value, onChange, accessibilityLabel }: Props) {
  const st = useThemedStyles(makeStyles);
  return (
    <View style={st.group} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}>
      {options.map((option) => (
        <Chip key={option.value} label={option.label} active={option.value === value} onPress={() => onChange(option.value)} />
      ))}
    </View>
  );
});

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const thumb = selectedOptionLook(theme.isDark, theme.colors);
  const lit = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    lit.value = withTiming(active ? 1 : 0, { duration: motion.respectReducedMotion(SWAP_MS) });
  }, [active, lit]);
  const litStyle = useAnimatedStyle(() => ({ opacity: lit.value }));
  return (
    <Pressable
      onPress={onPress}
      hitSlop={HIT_SLOP}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, checked: active }}
      style={({ pressed }) => [st.chip, pressed && st.pressed]}
    >
      <Animated.View style={[st.lit, { backgroundColor: thumb.bg, shadowOpacity: thumb.shadowOpacity }, litStyle]} collapsable={false}>
      </Animated.View>
      {active ? <Feather name="check" size={15} color={thumb.fg} /> : null}
      <Text style={[st.label, active && st.labelActive]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    group: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    chip: {
      minHeight: HEIGHT,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: spacing.md,
      borderRadius: HEIGHT / 2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border.subtle,
      backgroundColor: t.colors.fill.subtle,
      overflow: "hidden",
    },
    pressed: { transform: [{ scale: 0.96 }] },
    lit: { ...StyleSheet.absoluteFillObject, borderRadius: HEIGHT / 2, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowRadius: 3 },
    label: { ...typography.small, fontFamily: FONT_FAMILY.medium, color: t.colors.text.secondary },
    labelActive: { fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary },
  });
