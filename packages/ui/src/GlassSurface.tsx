import { forwardRef, type CSSProperties, type ReactNode } from "react";

import { GLASS_FILTER_ID } from "./glass/GlassFilters";
import { resolveGlassLevel, type GlassLevel } from "./glass/engine";

/**
 * Surface verre unifiée — pendant web du `GlassSurface` de `apps/mobile`.
 * Même vocabulaire de `tier` et de `tint`, pour que les deux plateformes se
 * décrivent pareil (règle R10 de design-system/MASTER.md).
 *
 * Remplace les 37 `backdrop-blur-*` écrits à la main dans autant de composants,
 * et branche enfin les tokens `--blur-*`, jusqu'ici définis mais morts côté web.
 *
 * Trois niveaux de rendu, choisis par le moteur (voir `glass/engine.ts`) :
 *  - `refraction` : flou + réfraction SVG — Chromium/WebView2 uniquement
 *  - `blur`       : flou + saturation + liseré + spéculaire — WebKit, Firefox
 *  - `flat`       : surface tokenisée sans flou — jamais une surface nue
 *
 * L'essentiel du rendu perçu vient du LISERÉ et du SPÉCULAIRE, pas de la
 * réfraction : le niveau `blur` lit déjà comme un matériau premium, la
 * réfraction n'est qu'un supplément.
 */

export type GlassTier = "subtle" | "dropdown" | "sheet" | "modal" | "overlay";
export type GlassTint = "regular" | "strong" | "panel";

/** Paliers de flou — alignés sur les tokens `--blur-*`. */
const TIER_BLUR: Record<GlassTier, string> = {
  subtle: "8px",
  dropdown: "var(--blur-dropdown)",
  sheet: "var(--blur-sheet)",
  modal: "var(--blur-modal)",
  overlay: "var(--blur-overlay)",
};

const TINT_BG: Record<GlassTint, string> = {
  regular: "var(--glass-tint)",
  strong: "var(--glass-tint-strong)",
  panel: "var(--glass-panel)",
};

export interface GlassSurfaceProps {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Intensité du flou. Défaut `sheet`. */
  tier?: GlassTier;
  /** Densité du voile. Défaut `regular`. */
  tint?: GlassTint;
  /** Rayon en px, ou une classe Tailwind via `className`. */
  radius?: number;
  /** Liseré interne clair — l'arête qui « attrape la lumière ». Défaut true. */
  bordered?: boolean;
  /** Reflet spéculaire en haut de la surface. Défaut true. */
  specular?: boolean;
  /**
   * Active la réfraction quand le moteur la supporte. Piloté par la préférence
   * utilisateur (`tentacle_liquid_glass`). Défaut true.
   */
  liquid?: boolean;
  as?: "div" | "aside" | "header" | "section" | "nav";
}

function backdropFor(level: GlassLevel, tier: GlassTier): string | undefined {
  if (level === "flat") return undefined;
  const blur = `blur(${TIER_BLUR[tier]}) saturate(180%)`;
  // La réfraction s'ajoute au flou : `url()` seul ne floute pas.
  return level === "refraction" ? `${blur} url(#${GLASS_FILTER_ID})` : blur;
}

export const GlassSurface = forwardRef<HTMLDivElement, GlassSurfaceProps>(
  function GlassSurface(
    {
      children,
      className = "",
      style,
      tier = "sheet",
      tint = "regular",
      radius,
      bordered = true,
      specular = true,
      liquid = true,
      as: Tag = "div",
    },
    ref,
  ) {
    const level = resolveGlassLevel(liquid);
    const backdrop = backdropFor(level, tier);

    const surfaceStyle: CSSProperties = {
      background: TINT_BG[tint],
      ...(backdrop
        ? { backdropFilter: backdrop, WebkitBackdropFilter: backdrop }
        : {}),
      ...(radius !== undefined ? { borderRadius: radius } : {}),
      ...(bordered
        ? { border: "1px solid var(--border-subtle)" }
        : {}),
      ...style,
    };

    return (
      <Tag ref={ref} className={`relative ${className}`} style={surfaceStyle}>
        {specular && level !== "flat" ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{
              // Arête supérieure : c'est ce liseré, plus que le flou, qui donne
              // l'impression d'une tranche de matériau et non d'un simple voile.
              background:
                "linear-gradient(90deg, transparent, var(--fill-medium) 22%, var(--fill-medium) 78%, transparent)",
              borderTopLeftRadius: "inherit",
              borderTopRightRadius: "inherit",
            }}
          />
        ) : null}

        {/*
          `isolation: isolate` crée un contexte d'empilement pour le contenu :
          le texte ne se compose plus avec le backdrop filtré en dessous, ce qui
          garantit sa lisibilité quelles que soient les couleurs traversées par
          la réfraction. C'est le point d'accessibilité central de cette surface.
        */}
        <div className="relative" style={{ isolation: "isolate" }}>
          {children}
        </div>
      </Tag>
    );
  },
);
