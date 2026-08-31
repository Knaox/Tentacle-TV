import { type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { useTheme } from "../../theme";

interface Props {
  direction?: "top" | "bottom";
  height?: number | string;
  /** Couleur cible du fade — défaut : fond racine du thème (surface.s0).
   *  Les rampes `strong`/`detail` en CLAIR plafonnent déjà à 0,70 : y passer
   *  un noir PUR (alpha 1), jamais un rgba pré-atténué — l'atténuation se
   *  multiplierait avec celle de la rampe (double voile). */
  color?: string;
  style?: ViewStyle;
  /** Intensité du fade. "strong" = hero (cinema-fade), "detail" = fiche média
   *  (extinction plus progressive), "soft" pour texte over media. */
  intensity?: "soft" | "strong" | "detail";
}

function withOpacity(color: string, opacity: number): string {
  const rgbaMatch = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
  if (rgbaMatch) {
    const [, r, g, b, a] = rgbaMatch;
    const baseAlpha = a !== undefined ? parseFloat(a) : 1;
    return `rgba(${r}, ${g}, ${b}, ${(baseAlpha * opacity).toFixed(2)})`;
  }
  const hex = Math.round(opacity * 255).toString(16).padStart(2, "0");
  return `${color}${hex}`;
}

/* Rampes recopiées du bureau (apps/web/src/theme/scrims.css —
 * --hero-scrim-bottom / --detail-scrim-bottom). Leur forme EST le correctif de
 * la « bande noire » : des pentes strictement CROISSANTES. L'ancienne rampe
 * [0, .25, .7, 1] @ [0, .35, .7, 1] accélérait puis retombait (pentes
 * .59 → 1.05 → .82) — une inversion de courbure imprime une bande de Mach,
 * ligne perçue là où aucune n'est tracée. En CLAIR le voile s'arrête à 0,70 et
 * ne rejoint jamais la page : l'affiche garde ses couleurs et le bord de carte
 * reste un vrai bord (scrims.css, bloc [data-theme="light"]). */
const LIGHT_MEDIA_RAMP = { stops: [0, 0.26, 0.5, 0.76, 1], alphas: [0, 0.12, 0.32, 0.54, 0.7] };
const RAMPS = {
  strong: {
    dark: { stops: [0, 0.34, 0.62, 0.85, 1], alphas: [0, 0.2, 0.5, 0.8, 1] },
    light: LIGHT_MEDIA_RAMP,
  },
  detail: {
    dark: { stops: [0, 0.2, 0.44, 0.68, 0.88, 1], alphas: [0, 0.14, 0.36, 0.64, 0.88, 1] },
    light: LIGHT_MEDIA_RAMP,
  },
  soft: {
    dark: { stops: [0, 0.35, 0.75, 1], alphas: [0, 0.1, 0.4, 0.85] },
    light: { stops: [0, 0.35, 0.75, 1], alphas: [0, 0.1, 0.4, 0.85] },
  },
};

/**
 * Overlay gradient — par défaut bottom-to-top fade vers le fond racine du
 * thème (noir en dark, clair en light). Utilisé pour les hero billboards
 * (cinematic fade), les overlays sur posters, etc.
 */
export function GradientOverlay({
  direction = "bottom", height, color, style, intensity = "strong",
}: Props) {
  const theme = useTheme();
  const resolvedColor = color ?? theme.colors.surface.s0;
  const { stops, alphas } = RAMPS[intensity][theme.isDark ? "dark" : "light"];

  const gradientColors: [string, string, ...string[]] = direction === "bottom"
    ? alphas.map((a) => withOpacity(resolvedColor, a)) as [string, string, ...string[]]
    : [...alphas].reverse().map((a) => withOpacity(resolvedColor, a)) as [string, string, ...string[]];

  const locations: [number, number, ...number[]] = stops as [number, number, ...number[]];

  return (
    <LinearGradient
      colors={gradientColors}
      locations={locations}
      style={[{
        position: "absolute",
        bottom: direction === "bottom" ? 0 : undefined,
        top: direction === "top" ? 0 : undefined,
        left: 0, right: 0,
        height: height as number ?? "55%",
      }, style]}
    />
  );
}
