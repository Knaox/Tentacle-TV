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
import { useTheme, useThemeMode } from "../../theme/appThemeContext";
import type { AppTheme } from "../../theme/palette.types";
import { getLiquidGlassModule } from "../../theme/liquidGlass";

/**
 * Surface verre unifiée — POINT DE BASCULE unique du rendu glass.
 *
 * Liquid Glass (iOS 26+, module natif présent, préférence activée,
 * `liquid !== false`) : rendu verre natif Apple via LiquidGlassView — le
 * voile maison et la border hairline sont retirés (le verre natif gère sa
 * matière et son bord lumineux), seul le radius est conservé.
 * Sinon : fallback maison éprouvé = voile teinté + BlurView + border
 * hairline (formule historique de GlassCard, thémée light/dark).
 * Aucun consommateur (GlassCard, RailMenu, MediaActionSheet, header
 * recherche...) n'a besoin d'être retouché : la bascule vit ici.
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
  interactive,
  liquid = true,
}: GlassSurfaceProps) {
  const theme = useTheme();
  const { liquidGlass } = useThemeMode();
  const resolvedIntensity = intensity ?? blurIntensity(tier);

  if (liquid && liquidGlass.enabled) {
    const mod = getLiquidGlassModule();
    if (mod && mod.isLiquidGlassSupported) {
      const { LiquidGlassView } = mod;
      return (
        <LiquidGlassView
          effect="regular"
          colorScheme={theme.scheme}
          interactive={interactive}
          style={[{ borderRadius: radius, overflow: "hidden" }, style]}
        >
          {children}
        </LiquidGlassView>
      );
    }
  }

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
  /** "backdrop" (canonique, glass.backdrop) ou un palier overlay.scrim*. */
  scrim?: "backdrop" | "scrim" | "scrimSoft" | "scrimHeavy";
  style?: StyleProp<ViewStyle>;
}

function resolveScrim(
  theme: AppTheme,
  scrim: NonNullable<GlassBackdropProps["scrim"]>,
): string {
  if (scrim === "backdrop") return theme.colors.glass.backdrop;
  return theme.colors.overlay[scrim];
}

/**
 * Fond de modale plein écran : blur + voile sombre. Se pose sous le Pressable
 * de fermeture du consommateur (aucune gestion tactile ici).
 */
export function GlassBackdrop({
  intensity,
  scrim = "backdrop",
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
          { backgroundColor: resolveScrim(theme, scrim) },
        ]}
      />
    </View>
  );
}
