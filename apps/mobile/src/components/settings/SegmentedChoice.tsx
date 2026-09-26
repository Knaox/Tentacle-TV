import { useEffect } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

import {
  spacing,
  typography,
  FONT_FAMILY,
  ctlGradient,
  motion,
  useTheme,
  useThemedStyles,
  type AppTheme,
} from "@/theme";

export interface ChoiceOption {
  value: string;
  label: string;
}

interface Props {
  options: ChoiceOption[];
  value: string;
  onChange: (value: string) => void;
  /** Libellé accessible du groupe — les boutons n'en portent pas de contexte. */
  accessibilityLabel: string;
  /** Quatre options sur un téléphone : deux par rangée, sinon un mot se coupe. */
  wrap?: boolean;
  /**
   * Variante EN LIGNE : largeur du contenu, posée à droite d'une ligne de
   * réglage. Deux ou trois mots courts ne méritent pas un pavé pleine largeur.
   */
  compact?: boolean;
}

const SWAP_MS = 150;
const COMPACT_HIT_SLOP = { top: 6, bottom: 6 } as const;

/**
 * Un choix parmi deux à quatre valeurs, dans UN cadre : le sélecteur segmenté
 * du web (`.ctl-segment`), au pixel. L'option retenue n'est pas un pavé plein
 * mais un CALQUE de dégradé de marque posé sous son libellé, présent sur
 * toutes les options à opacité nulle — passer de l'une à l'autre est un fondu
 * croisé, jamais un fond conditionnel (que Fabric Android rend sans rayon).
 *
 * Un `Switch` ne sait dire que oui ou non, et une liste modale pour trois
 * valeurs coûte deux gestes là où il en faut un.
 */
export function SegmentedChoice({ options, value, onChange, accessibilityLabel, wrap, compact }: Props) {
  const st = useThemedStyles(makeStyles);
  return (
    <View style={[st.group, wrap && st.groupWrap, compact && st.groupCompact]} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}>
      {options.map((option) => (
        <SegmentOption
          key={option.value}
          label={option.label}
          active={option.value === value}
          wrap={wrap}
          compact={compact}
          onPress={() => { onChange(option.value); }}
        />
      ))}
    </View>
  );
}

function SegmentOption({ label, active, wrap, compact, onPress }: {
  label: string;
  active: boolean;
  wrap?: boolean;
  compact?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const gradient = ctlGradient(theme.colors.brand);
  const lit = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    lit.value = withTiming(active ? 1 : 0, { duration: motion.respectReducedMotion(SWAP_MS) });
  }, [active, lit]);
  const litStyle = useAnimatedStyle(() => ({ opacity: lit.value }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: active, checked: active }}
      // La variante compacte dessine 32 pt : la zone tactile, elle, en garde 44.
      hitSlop={compact ? COMPACT_HIT_SLOP : undefined}
      style={({ pressed }) => [st.option, wrap && st.optionWrap, compact && st.optionCompact, pressed && st.pressed]}
    >
      <Animated.View style={[st.lit, litStyle]} collapsable={false}>
        <LinearGradient
          colors={gradient.colors}
          locations={gradient.locations}
          start={gradient.start}
          end={gradient.end}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      {/* Deux lignes, pas une : un libellé de choix doit se lire en entier. */}
      <Text style={[st.label, active && st.labelActive]} numberOfLines={compact ? 1 : 2}>
        {label}
      </Text>
    </Pressable>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    group: {
      flexDirection: "row",
      gap: 2,
      padding: 2,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border.subtle,
      backgroundColor: t.colors.surface.s1,
    },
    groupWrap: { flexWrap: "wrap" },
    groupCompact: { alignSelf: "flex-start", flexShrink: 0 },
    option: {
      flex: 1,
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      borderRadius: 6,
      overflow: "hidden",
    },
    optionWrap: { flex: 0, flexGrow: 1, flexBasis: "48%" },
    optionCompact: { flex: 0, minHeight: 32, minWidth: 52, paddingVertical: 0, paddingHorizontal: spacing.md - 2 },
    pressed: { transform: [{ scale: 0.97 }] },
    // Lueur discrète `--ctl-glow-segment`, sans liseré : un état, pas un bouton.
    lit: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 6,
      shadowColor: t.colors.brand.violet,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.28,
      shadowRadius: 6,
    },
    label: {
      ...typography.small,
      fontFamily: FONT_FAMILY.medium,
      color: t.colors.text.tertiary,
      textAlign: "center",
    },
    labelActive: {
      fontFamily: FONT_FAMILY.semibold,
      color: t.colors.cta.brandFg,
    },
  });
