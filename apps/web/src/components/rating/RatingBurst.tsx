import { useEffect, useMemo } from "react";
import type { CSSProperties } from "react";

/**
 * Durée du jet. Au-delà des 500 ms que `theme/motion` fixe aux transitions
 * composées, et c'est voulu : une célébration se regarde, elle ne couvre pas
 * une attente. Jamais bridée par `cadence` — c'est la réponse à un geste.
 */
export const BURST_MS = 650;
const COUNT = 10;
const COLORS = ["var(--brand-accent)", "var(--brand)", "#ffffff", "var(--brand-accent-light)"];

export interface BurstParticle {
  dx: number;
  dy: number;
  rot: number;
  color: string;
  delay: number;
  size: number;
}

/** Géométrie DÉTERMINISTE : même éventail à chaque note, donc testable. */
export function burstParticles(count = COUNT): BurstParticle[] {
  return Array.from({ length: count }, (_, i) => {
    // Éventail de 200° ouvert vers le haut : les confettis jaillissent de l'étoile.
    const angle = ((-190 + (i * 200) / (count - 1)) * Math.PI) / 180;
    const distance = 18 + (i % 3) * 7;
    return {
      dx: Math.round(Math.cos(angle) * distance),
      dy: Math.round(Math.sin(angle) * distance),
      rot: (i % 2 ? 1 : -1) * (90 + i * 25),
      color: COLORS[i % COLORS.length],
      delay: (i % 3) * 20,
      size: 4 + (i % 2) * 2,
    };
  });
}

/**
 * Jet de confettis au centre de son parent (`position: relative`) : dix
 * particules, transform + opacité seulement (cf. `.rating-burst-particle`),
 * démonté une fois le jet fini. Sous `prefers-reduced-motion`, la politique
 * globale ramène l'animation à zéro : le jet reste invisible.
 */
export function RatingBurst({ onDone }: { onDone: () => void }) {
  const particles = useMemo(() => burstParticles(), []);
  useEffect(() => {
    const id = setTimeout(onDone, BURST_MS + 120);
    return () => clearTimeout(id);
  }, [onDone]);

  return (
    <span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 z-10">
      {particles.map((p, i) => (
        <span
          key={i}
          className="rating-burst-particle absolute rounded-sm"
          style={
            {
              "--dx": `${p.dx}px`,
              "--dy": `${p.dy}px`,
              "--rot": `${p.rot}deg`,
              animationDelay: `${p.delay}ms`,
              background: p.color,
              width: p.size,
              height: p.size,
            } as CSSProperties
          }
        />
      ))}
    </span>
  );
}
