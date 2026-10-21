import { motion } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";
import { Place, type Animated, type Placed } from "../Place";
import { instant, sceneSpring } from "../sceneMotion";

/**
 * Le niveau du matériau, comme dans l'app : `regular` (barres, menus),
 * `clear` (sur la vidéo : presque rien, un voile neutre de lisibilité, comme le
 * lecteur), `tinted` (la marque en touche : onglet actif, piste choisie).
 */
export type FauxGlassLevel = "regular" | "clear" | "tinted";

interface FauxGlassProps extends Placed, Animated {
  level?: FauxGlassLevel;
  /** Rayon des coins, en px logiques ; une capsule par défaut. */
  radius?: number;
  /** 0..1 : où tombe le reflet, de gauche à droite — il suit le pointeur de la scène. */
  sheen?: number;
  reduced: boolean;
  className?: string;
  children?: ReactNode;
}

/** Le matériau de l'app, lu dans ses jetons (`theme/liquidGlassTokens.css`), clair ET sombre. */
function materialOf(level: FauxGlassLevel): CSSProperties {
  const filter = `blur(var(--lg-${level}-blur)) saturate(var(--lg-${level}-saturate)) brightness(var(--lg-${level}-brightness))`;
  return {
    backdropFilter: filter,
    WebkitBackdropFilter: filter,
    // Sur la vidéo, le lecteur ajoute un voile NEUTRE presque nul (QuickTime, TV) : `--lg-clear-dim`.
    background: level === "clear" ? "linear-gradient(var(--lg-clear-dim), var(--lg-clear-dim)), var(--lg-clear-fill)" : `var(--lg-${level}-fill)`,
    boxShadow:
      "inset 1px 1px 0 var(--lg-specular-strong), inset -1px -1px 0 var(--lg-specular-soft), inset 0 0 0 var(--lg-rim-width) var(--lg-rim), var(--lg-shadow-float)",
  };
}

const SHEEN = "linear-gradient(105deg, transparent 25%, var(--lg-highlight) 50%, transparent 75%)";

/**
 * Une surface en Liquid Glass, en PEINTURE : la scène ne peut pas poser le
 * verre natif de macOS (une vue du système, sous la page), elle le dessine
 * avec le MATÉRIAU de l'app — ses jetons `--lg-*`, `backdrop-filter` sur
 * l'image de la scène, arêtes, liseré, reflet qui suit le pointeur. Seul le
 * reflet bouge, en `transform` ; la scène n'est montée que lorsqu'elle est sur
 * scène (règles « Coût GPU »).
 */
export function FauxGlass({
  level = "regular", radius = 999, sheen = 0.3, reduced, className, children, ...place
}: FauxGlassProps) {
  return (
    <Place {...place}>
      <div className="relative h-full w-full overflow-hidden" style={{ borderRadius: radius, ...materialOf(level) }}>
        <motion.span
          aria-hidden
          className="absolute inset-y-0 left-0 w-full"
          style={{ background: SHEEN }}
          initial={false}
          animate={{ x: `${Math.round((sheen - 0.5) * 100)}%` }}
          transition={reduced ? instant : sceneSpring}
        />
        <div className={`relative h-full w-full ${className ?? ""}`} style={{ textShadow: "var(--lg-media-label-shadow)" }}>
          {children}
        </div>
      </div>
    </Place>
  );
}
