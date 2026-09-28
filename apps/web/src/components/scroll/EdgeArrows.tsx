import type { CSSProperties } from "react";
import { PressableScale } from "../ui/PressableScale";

interface EdgeArrowsProps {
  canLeft: boolean;
  canRight: boolean;
  /** Présentes dans le DOM (survol de la bande, et le temps du fondu de sortie). */
  mounted: boolean;
  /** Cible du fondu : vrai tant que le curseur est sur la bande. */
  shown: boolean;
  onScroll: (direction: "left" | "right") => void;
  /** `sm` pour une bande de pastilles, `md` pour une rangée de cartes. */
  size?: "sm" | "md";
}

const DISC_SIZE = { sm: "h-9 w-9", md: "h-10 w-10" } as const;

/**
 * Les flèches d'une bande qui défile : le disque de verre des rangées de
 * l'accueil (`RowScrollControls`) — même surface, même liseré qui vire à la
 * marque au survol, même ressort — posé seul au bord, sans rien derrière. Le
 * bord de la bande s'efface par masque (`edgeFadeMask`) : c'est lui qui dit
 * « ça continue », plus un pavé sombre.
 *
 * Une flèche n'existe que du côté où la bande déborde, et seulement pendant
 * le survol : chaque disque porte un `backdrop-filter`, qui se recalcule à
 * chaque image tant qu'il est dans le DOM, visible ou non.
 *
 * `aria-hidden` et hors tabulation : au clavier, la bande défile par ses
 * propres touches fléchées.
 */
export function EdgeArrows({ canLeft, canRight, mounted, shown, onScroll, size = "sm" }: EdgeArrowsProps) {
  if (!mounted) return null;
  return (
    <>
      {canLeft && <Arrow side="left" shown={shown} size={size} onClick={() => onScroll("left")} />}
      {canRight && <Arrow side="right" shown={shown} size={size} onClick={() => onScroll("right")} />}
    </>
  );
}

function Arrow({ side, shown, size, onClick }: { side: "left" | "right"; shown: boolean; size: "sm" | "md"; onClick: () => void }) {
  return (
    <div
      className={`hover-reveal pointer-events-none absolute inset-y-0 z-20 flex items-center ${side === "left" ? "left-1" : "right-1"}`}
      data-shown={shown}
      style={{ "--reveal-ms": "150ms" } as CSSProperties}
    >
      <PressableScale
        hoverScale={1.08}
        tapScale={0.92}
        onClick={onClick}
        tabIndex={-1}
        aria-hidden="true"
        className={`pointer-events-auto flex ${DISC_SIZE[size]} items-center justify-center rounded-full bg-glass-tint text-content-primary shadow-[var(--elev-2)] ring-1 ring-line-subtle backdrop-blur-md transition-colors hover:ring-[rgba(var(--brand-rgb),0.55)]`}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d={side === "left" ? "M15 19l-7-7 7-7" : "M9 5l7 7-7 7"} />
        </svg>
      </PressableScale>
    </div>
  );
}
