import { memo, useMemo, type ReactNode } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";

import { ctaGradient, FONT_FAMILY, useTheme } from "../../../theme";
import { haptic, type HapticCue } from "../../../utils/haptics";
import { GlassFill } from "./GlassFill";
import {
  pressOverlayColor,
  resolveButtonLook,
  type ButtonKind,
  type ButtonSize,
  type ButtonTone,
} from "./buttonLook";

export type FeatherName = keyof typeof Feather.glyphMap;

/** Ce que tous les boutons du système acceptent. */
export interface ButtonProps {
  label: string;
  onPress: () => void;
  /** Pictogramme Feather, à gauche du libellé. */
  icon?: FeatherName;
  /** Pictogramme à DROITE (chevron d'un lien, flèche « suivant »). */
  trailingIcon?: FeatherName;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  /** Pleine largeur (le pied d'une feuille, un formulaire). */
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** Signal haptique ; `false` le coupe. Défaut : « tap » (« destructive » pour un danger). */
  haptic?: HapticCue | false;
  testID?: string;
}

interface BaseProps extends ButtonProps {
  kind: ButtonKind;
  tone?: ButtonTone;
  children?: ReactNode;
}

const PLATFORM = Platform.OS === "android" ? "android" : "ios";

/**
 * Le socle commun : la cible tactile (≥ 44 pt / 48 dp par `hitSlop`), le
 * retour d'appui de la plateforme (voile sur iOS, ondulation sur Android),
 * l'attente et l'état désactivé. L'apparence vient de `resolveButtonLook`.
 * Hauteur en `minHeight` : un libellé agrandi par la taille de texte du
 * système fait grandir le bouton au lieu d'être coupé.
 */
export const ButtonBase = memo(function ButtonBase({
  kind, tone = "neutral", label, onPress, icon, trailingIcon, size = "md", loading, disabled,
  fullWidth, style, accessibilityLabel, accessibilityHint, haptic: cue, testID,
}: BaseProps) {
  const theme = useTheme();
  const look = useMemo(
    () => resolveButtonLook({ platform: PLATFORM, kind, tone, size, isDark: theme.isDark, colors: theme.colors }),
    [kind, tone, size, theme],
  );
  const overlay = pressOverlayColor(kind, tone, theme.isDark);
  const inactive = !!disabled || !!loading;
  const hapticCue: HapticCue | false = cue ?? (tone === "destructive" ? "destructive" : "tap");

  const handlePress = () => {
    if (hapticCue) haptic(hapticCue);
    onPress();
  };

  const shape: ViewStyle = {
    minHeight: look.height,
    borderRadius: look.radius,
    paddingHorizontal: look.padX,
    borderWidth: look.borderWidth,
    borderColor: look.borderColor ?? undefined,
    backgroundColor: look.fill.kind === "solid" ? look.fill.color : undefined,
  };
  const gradient = look.fill.kind === "brand" ? ctaGradient(theme.colors.brand) : null;

  return (
    <Pressable
      testID={testID}
      onPress={handlePress}
      disabled={inactive}
      hitSlop={{ top: look.hitSlopY, bottom: look.hitSlopY, left: 4, right: 4 }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: !!loading }}
      android_ripple={PLATFORM === "android" ? { color: overlay, borderless: false, foreground: true } : undefined}
      style={[
        st.root,
        shape,
        fullWidth ? st.full : null,
        inactive && !loading ? st.disabled : null,
        // L'ondulation d'Android ne déborde pas d'un bouton arrondi que s'il rogne.
        PLATFORM === "android" ? st.clip : null,
        style,
      ]}
    >
      {({ pressed }) => (
        <>
          {gradient ? (
            <LinearGradient
              colors={gradient.colors}
              start={gradient.start}
              end={gradient.end}
              style={[StyleSheet.absoluteFill, { borderRadius: look.radius }]}
            />
          ) : null}
          {look.fill.kind === "glass" ? <GlassFill radius={look.radius} /> : null}
          {PLATFORM === "ios" && kind !== "plain" ? (
            <View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, { borderRadius: look.radius, backgroundColor: overlay, opacity: pressed ? 1 : 0 }]}
            />
          ) : null}
          <View style={[st.row, { gap: look.gap }, loading ? st.hidden : null]}>
            {icon ? <Feather name={icon} size={look.iconSize} color={look.fg} /> : null}
            <Text
              numberOfLines={1}
              style={{
                color: look.fg,
                fontSize: look.fontSize,
                fontFamily: look.weight === "semibold" ? FONT_FAMILY.semibold : FONT_FAMILY.medium,
                letterSpacing: look.letterSpacing,
                // Un texte seul s'efface un peu à l'appui (le voile ne se voit pas sans fond).
                opacity: kind === "plain" && pressed && PLATFORM === "ios" ? 0.45 : 1,
              }}
            >
              {label}
            </Text>
            {trailingIcon ? <Feather name={trailingIcon} size={look.iconSize} color={look.fg} /> : null}
          </View>
          {loading ? <ActivityIndicator style={StyleSheet.absoluteFill} color={look.fg} size="small" /> : null}
        </>
      )}
    </Pressable>
  );
});

const st = StyleSheet.create({
  root: { alignItems: "center", justifyContent: "center", flexDirection: "row" },
  full: { alignSelf: "stretch" },
  clip: { overflow: "hidden" },
  disabled: { opacity: 0.4 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  hidden: { opacity: 0 },
});
