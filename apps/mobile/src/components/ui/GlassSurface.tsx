import { type ReactNode } from "react";
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { BlurView } from "expo-blur";

import { RADIUS } from "../../theme";
import { BLUR_INTENSITY, blurIntensity } from "../../theme/effects";
import { useTheme } from "../../theme/appThemeContext";
import type { AppTheme } from "../../theme/palette.types";

/**
 * Surface verre unifiée — POINT DE BASCULE unique du rendu glass.
 *
 * Aujourd'hui : fallback maison éprouvé = voile teinté + BlurView + border
 * hairline (formule historique de GlassCard, thémée light/dark).
 * Phase Liquid Glass : ce composant branchera LiquidGlassView (iOS 26+)
 * quand le module est présent, supporté et activé — aucun consommateur
 * (GlassCard, RailMenu, MediaActionSheet, header recherche...) à retoucher.
 */

type BlurTier = keyof typeof BLUR_INTENSITY;

export interface GlassSurfaceProps {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Palier sémantique BLUR_INTENSITY (subtle/dropdown/sheet/modal/overlay). */
  tier?: BlurTier;
  /** Override brut expo-blur 0-100 — pour rester pixel-perfect en migration. */
  intensity?: number;
  /** Voile : regular (cartes), strong (panneaux denses), panel (fond sheet). */
  tint?: "regular" | "strong" | "panel";
  radius?: number;
  /** Border hairline `border.subtle` (défaut true). */
  bordered?: boolean;
  /** Réponse tactile Liquid Glass (ignoré par le fallback blur). */
  interactive?: boolean;
  /** Opt-out Liquid Glass pour cette surface (défaut true = éligible). */
  liquid?: boolean;
}

function resolveTint(theme: AppTheme, tint: "regular" | "strong" | "panel"): string {
  if (tint === "panel") return theme.colors.glass.panel;
  if (tint === "strong") return theme.colors.glass.tintStrong;
  return theme.colors.glass.tint;
}

export function GlassSurface({
  children,
  style,
  tier = "modal",
  intensity,
  tint = "regular",
  radius = RADIUS.lg,
  bordered = true,
  // Consommés par la branche Liquid Glass (phase dédiée) — inertes en fallback.
  interactive: _interactive,
  liquid: _liquid = true,
}: GlassSurfaceProps) {
  const theme = useTheme();
  const resolvedIntensity = intensity ?? blurIntensity(tier);

  return (
    <View
      style={[
        {
          borderRadius: radius,
          overflow: "hidden",
          backgroundColor: resolveTint(theme, tint),
        },
        bordered && {
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.border.subtle,
        },
        style,
      ]}
    >
      <BlurView
        intensity={resolvedIntensity}
        tint={theme.blurTint}
        style={StyleSheet.absoluteFillObject}
      />
      {children}
    </View>
  );
}

export interface GlassBackdropProps {
  /** Défaut : palier "sheet" (backdrops BottomSheet / MediaActionSheet). */
  intensity?: number;
  scrim?: "scrim" | "scrimSoft" | "scrimHeavy";
  style?: StyleProp<ViewStyle>;
}

/**
 * Fond de modale plein écran : blur + voile sombre. Se pose sous le Pressable
 * de fermeture du consommateur (aucune gestion tactile ici).
 */
export function GlassBackdrop({
  intensity,
  scrim = "scrim",
  style,
}: GlassBackdropProps) {
  const theme = useTheme();

  return (
    <View style={[StyleSheet.absoluteFillObject, style]}>
      <BlurView
        intensity={intensity ?? blurIntensity("sheet")}
        tint={theme.blurTint}
        style={StyleSheet.absoluteFillObject}
      />
      <View
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: theme.colors.overlay[scrim] },
        ]}
      />
    </View>
  );
}
