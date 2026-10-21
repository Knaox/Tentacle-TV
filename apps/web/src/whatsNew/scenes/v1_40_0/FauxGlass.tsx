import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { Place, type Animated, type Placed } from "../Place";
import { instant, sceneSpring } from "../sceneMotion";

interface FauxGlassProps extends Placed, Animated {
  /** Rayon des coins, en px logiques ; une capsule par défaut. */
  radius?: number;
  /** Le verre teinté aux couleurs de la marque (le bouton principal, l'onglet actif). */
  tinted?: boolean;
  /** 0..1 : où tombe le reflet, de gauche à droite — il suit le pointeur de la scène. */
  sheen?: number;
  reduced: boolean;
  className?: string;
  children?: ReactNode;
}

/** Le verre d'Apple dessiné dans la scène : flou saturé, liseré clair, reflet. */
const GLASS_FILTER = "blur(10px) saturate(1.9) brightness(1.06)";
const GLASS_CLEAR = "rgba(255, 255, 255, 0.1)";
const GLASS_TINT = "linear-gradient(135deg, rgba(var(--brand-rgb), 0.5) 0%, rgba(var(--brand-accent-rgb), 0.38) 100%)";
const GLASS_EDGE =
  "inset 0 1px 0 rgba(255, 255, 255, 0.5), inset 0 -1px 0 rgba(255, 255, 255, 0.1), inset 0 0 0 1px rgba(255, 255, 255, 0.16), 0 10px 26px rgba(0, 0, 0, 0.3)";
const SHEEN = "linear-gradient(105deg, transparent 20%, rgba(255, 255, 255, 0.24) 50%, transparent 80%)";

/**
 * Une surface en Liquid Glass, en PEINTURE : la scène ne peut pas poser le
 * verre natif de macOS (une vue du système, sous la page), elle le dessine —
 * `backdrop-filter` sur l'image de la scène, un liseré, un reflet qui suit le
 * pointeur. Seul le reflet bouge, en `transform` ; la scène n'est montée que
 * lorsqu'elle est sur scène (règles « Coût GPU »). Ce qui est dessiné ici est
 * une image de démonstration, pas le chrome de l'app.
 */
export function FauxGlass({
  radius = 999, tinted = false, sheen = 0.3, reduced, className, children, ...place
}: FauxGlassProps) {
  return (
    <Place {...place}>
      <div
        className="relative h-full w-full overflow-hidden"
        style={{
          borderRadius: radius,
          backdropFilter: GLASS_FILTER,
          WebkitBackdropFilter: GLASS_FILTER,
          background: tinted ? GLASS_TINT : GLASS_CLEAR,
          boxShadow: GLASS_EDGE,
        }}
      >
        <motion.span
          aria-hidden
          className="absolute inset-y-0 left-0 w-full"
          style={{ background: SHEEN }}
          initial={false}
          animate={{ x: `${Math.round((sheen - 0.5) * 100)}%` }}
          transition={reduced ? instant : sceneSpring}
        />
        <div className={`relative h-full w-full ${className ?? ""}`}>{children}</div>
      </div>
    </Place>
  );
}
