import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Place, type Animated } from "../Place";
import { sceneTween } from "../sceneMotion";

/** Le menu de l'avatar, accroché sous le rond du compte, aligné sur le bord droit de la capsule. */
export const MENU = { x: 412, y: 66, w: 216 } as const;
export const MENU_HEADER_H = 58;
export const MENU_ROW_H = 32;
/** Le voyage du pointeur (`cursorTravel`, 0,55 s), presque achevé. */
const HOVER_DELAY_S = 0.4;

/**
 * Le panneau du menu de l'avatar (`Dropdown` : fond, liseré, rayon, ombre),
 * sans le flou — règle du kit. Au-dessus des cartes de l'accueil : leurs
 * badges ont leur propre z-index.
 */
export function MenuPanel({ children, ...animated }: Animated & { children: ReactNode }) {
  return (
    <Place x={MENU.x} y={MENU.y} w={MENU.w} style={{ transformOrigin: "top right", zIndex: 15 }} {...animated}>
      <div
        className="overflow-hidden"
        style={{
          background: "var(--surface-dropdown)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-dropdown)",
        }}
      >
        {children}
      </div>
    </Place>
  );
}

/** Une entrée du menu ; son survol s'allume quand le pointeur ARRIVE, pas à son départ. */
export function MenuRow({ icon, label, hovered = false }: { icon: ReactNode; label: string; hovered?: boolean }) {
  return (
    <div className={`relative flex items-center px-3 text-[12px] ${hovered ? "text-content-primary" : "text-content-secondary"}`} style={{ height: MENU_ROW_H }}>
      <motion.span
        className="absolute inset-0 bg-fill-subtle"
        initial={false}
        animate={{ opacity: hovered ? 1 : 0 }}
        transition={hovered ? { ...sceneTween, delay: HOVER_DELAY_S } : sceneTween}
      />
      <span className="relative mr-2.5 flex w-4 justify-center">{icon}</span>
      <span className="relative whitespace-nowrap">{label}</span>
    </div>
  );
}
