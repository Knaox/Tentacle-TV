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
  /**
   * Ombre portée douce (thème CLAIR uniquement) pour détacher la carte du fond
   * nacré. Réservé aux surfaces à taille de CONTENU (cartes) : évitez-la sur les
   * surfaces en remplissage (absoluteFill/flex) où l'inner s'effondrerait. Sombre
   * ou fallback désactivé → rendu strictement inchangé.
   */
  elevated?: boolean;
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
  elevated = false,
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

  // Ombre douce uniquement en CLAIR + opt-in `elevated` (cartes). Impossible sur
  // la vue clippée (overflow: hidden clippe l'ombre sous iOS) → wrapper externe.
  const applyShadow = elevated && !theme.isDark;

  const inner = (
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
        // Hors ombre : le style consommateur reste ici → rendu STRICTEMENT
        // inchangé (sombre, fallback, surfaces en remplissage). Avec ombre, il
        // migre sur le wrapper porteur d'ombre ci-dessous.
        applyShadow ? null : style,
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

  if (!applyShadow) return inner;

  // Wrapper externe NON clippé : porte le layout consommateur puis shadow.card
  // (en dernier → l'emporte sur une ombre sombre passée par le consommateur,
  // ex. GlassCard/elev2). L'inner s'étire à la largeur du wrapper (colonne).
  return (
    <View style={[{ borderRadius: radius }, style, theme.colors.shadow.card]}>
      {inner}
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
