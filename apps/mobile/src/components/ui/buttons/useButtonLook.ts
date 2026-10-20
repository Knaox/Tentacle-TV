import { useMemo } from "react";
import { Platform, type ViewStyle } from "react-native";

import { useTheme } from "../../../theme";
import { resolveButtonLook, type ButtonKind, type ButtonLook, type ButtonSize, type ButtonTone } from "./buttonLook";

/**
 * L'apparence d'un bouton du système, pour un `Pressable` qui doit rester
 * maison (une référence d'ancrage, un compteur à droite) : mêmes mesures,
 * mêmes couleurs que `SecondaryButton` & co. `shape` se pose tel quel.
 */
export function useButtonLook(kind: ButtonKind, size: ButtonSize = "md", tone: ButtonTone = "neutral"): ButtonLook & { shape: ViewStyle } {
  const theme = useTheme();
  return useMemo(() => {
    const look = resolveButtonLook({
      platform: Platform.OS === "android" ? "android" : "ios",
      kind,
      tone,
      size,
      isDark: theme.isDark,
      colors: theme.colors,
    });
    const shape: ViewStyle = {
      minHeight: look.height,
      borderRadius: look.radius,
      paddingHorizontal: look.padX,
      borderWidth: look.borderWidth,
      borderColor: look.borderColor ?? undefined,
      backgroundColor: look.fill.kind === "solid" ? look.fill.color : undefined,
    };
    return { ...look, shape };
  }, [kind, size, tone, theme]);
}
