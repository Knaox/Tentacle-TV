import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { useSceneMedia } from "../sceneMedia";
import { CARD_TONES } from "./FauxCard";
import { Place, type Animated, type Placed } from "./Place";
import { sceneTween } from "./sceneMotion";

interface ScenePlayerPanelProps extends Placed, Animated {
  /** 0..1. */
  progress?: number;
  caption?: string;
  /** En haut à droite : sélecteur de qualité, badges… */
  children?: ReactNode;
}

/**
 * Un cadre de lecture 16:9 : la vraie image de fond de la sélection du
 * bandeau, un scrim bas, le titre, une barre de lecture. Le fond est une
 * image, pas du chrome : il peut avoir son noir.
 */
export function ScenePlayerPanel({ progress = 0, caption, children, w = 320, ...place }: ScenePlayerPanelProps) {
  const { backdrop } = useSceneMedia();
  return (
    <Place {...place} w={w} h={Math.round((w * 9) / 16)}>
      <div className="relative h-full w-full overflow-hidden rounded-[var(--radius-lg)] bg-surface-0" style={{ boxShadow: "var(--elev-2)" }}>
        {backdrop ? (
          <img src={backdrop.url} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0" style={{ background: CARD_TONES[1] }} />
        )}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0, 0, 0, 0.85) 0%, rgba(0, 0, 0, 0.35) 45%, transparent 75%)" }} />
        <div className="absolute inset-x-4 bottom-4">
          <p className="truncate text-[15px] font-bold leading-tight text-white">{backdrop?.title ?? " "}</p>
          {caption && <p className="mt-0.5 text-[11px] text-white/75">{caption}</p>}
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full" style={{ background: "rgba(255, 255, 255, 0.28)" }}>
            <motion.div
              className="h-full w-full origin-left rounded-full bg-[var(--brand)]"
              initial={false}
              animate={{ scaleX: Math.max(0, Math.min(1, progress)) }}
              transition={sceneTween}
            />
          </div>
        </div>
        {children && <div className="absolute right-3 top-3">{children}</div>}
      </div>
    </Place>
  );
}
