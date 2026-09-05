import { motion, type Transition } from "framer-motion";
import type { ReactNode } from "react";
import { Place, type Animated, type Placed } from "./Place";
import { sceneTween } from "./sceneMotion";

interface FauxCardProps extends Placed, Animated {
  /** Affiche 2:3 (par défaut) ou panneau large 16:9. */
  variant?: "poster" | "panel";
  /** Teinte du faux visuel, 0..5 — des dégradés différents pour des affiches différentes. */
  tone?: number;
  label?: string;
  /** Soulevée : échelle et ombre (deux calques en fondu d'opacité, jamais une ombre animée). */
  lifted?: boolean;
  /** En retrait (filtrée, inactive) : opacité réduite, toujours en place. */
  dimmed?: boolean;
  /** 0..1 : barre de progression au pied. */
  progress?: number;
  transition?: Transition;
  children?: ReactNode;
}

/** Les faux visuels : des dégradés tirés des jetons, jamais une image. */
export const CARD_TONES = [
  "linear-gradient(160deg, var(--brand) 0%, var(--brand-accent) 100%)",
  "linear-gradient(160deg, var(--brand-dark) 0%, var(--brand) 100%)",
  "linear-gradient(160deg, var(--brand-accent) 0%, var(--brand-accent-light) 100%)",
  "linear-gradient(160deg, var(--fill-strong) 0%, var(--fill-medium) 100%)",
  "linear-gradient(160deg, rgba(var(--brand-rgb), 0.55) 0%, var(--fill-strong) 100%)",
  "linear-gradient(160deg, rgba(var(--brand-accent-rgb), 0.5) 0%, var(--fill-medium) 100%)",
];

/**
 * Une fausse carte de média : un visuel en dégradé, deux lignes de titre
 * factices, une barre de progression optionnelle, et une surimpression pour
 * ce que la scène veut y poser (étoiles, pastille Lecture…).
 */
export function FauxCard({
  variant = "poster", tone = 0, label, lifted = false, dimmed = false, progress, transition,
  w = 72, h, scale, children, ...place
}: FauxCardProps) {
  const height = h ?? Math.round(variant === "poster" ? w * 1.5 : w * 0.5625);
  return (
    <Place {...place} w={w} h={height} scale={scale ?? (lifted ? 1.06 : 1)} transition={transition} className="isolate">
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 rounded-md"
        style={{ boxShadow: "var(--elev-card-hover)" }}
        initial={false}
        animate={{ opacity: lifted ? 1 : 0 }}
        transition={sceneTween}
      />
      <motion.div
        className="relative h-full w-full overflow-hidden rounded-md"
        style={{ background: CARD_TONES[tone % CARD_TONES.length] }}
        initial={false}
        animate={{ opacity: dimmed ? 0.3 : 1 }}
        transition={sceneTween}
      >
        {/* Ombre de bas d'affiche : c'est une image, elle peut avoir son noir. */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0, 0, 0, 0.5), transparent 55%)" }} />
        <div className="absolute bottom-2 left-2 right-2 space-y-1">
          {label ? (
            <span className="block truncate text-[9px] font-semibold leading-none text-white">{label}</span>
          ) : (
            <>
              <span className="block h-1.5 w-3/4 rounded-sm" style={{ background: "rgba(255, 255, 255, 0.8)" }} />
              <span className="block h-1 w-1/2 rounded-sm" style={{ background: "rgba(255, 255, 255, 0.45)" }} />
            </>
          )}
        </div>
        {progress !== undefined && (
          <div className="absolute inset-x-0 bottom-0 h-1" style={{ background: "rgba(0, 0, 0, 0.45)" }}>
            <motion.div
              className="h-full w-full origin-left bg-gradient-to-r from-[var(--brand)] to-[var(--brand-accent)]"
              initial={false}
              animate={{ scaleX: Math.max(0, Math.min(1, progress)) }}
              transition={sceneTween}
            />
          </div>
        )}
        {children && <div className="absolute inset-0 flex items-center justify-center">{children}</div>}
      </motion.div>
    </Place>
  );
}
