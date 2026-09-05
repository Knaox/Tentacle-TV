import { useMemo, type CSSProperties } from "react";
import { burstParticles } from "../../components/rating/RatingBurst";

interface FauxConfettiProps {
  /** L'origine du jet, en px logiques. */
  x: number;
  y: number;
  /** Monté pendant le pas du jet, démonté sinon : le jet rejoue à chaque boucle. */
  fire: boolean;
  reduced: boolean;
}

/** Le jet est plus ample que celui d'une note : la scène est vue de loin. */
const SPREAD = 1.7;

/**
 * Les confettis d'une note validée — la MÊME géométrie et la même animation
 * que `RatingBurst` (`.rating-burst-particle`, 650 ms, transform + opacité).
 * Sous mouvement réduit, la feuille ne ramène pas ces 650 ms à zéro : on pose
 * les particules à leur position finale, immobiles.
 */
export function FauxConfetti({ x, y, fire, reduced }: FauxConfettiProps) {
  const particles = useMemo(() => burstParticles(), []);
  if (!fire) return null;
  return (
    <span aria-hidden className="pointer-events-none absolute z-20" style={{ left: x, top: y }}>
      {particles.map((p, i) => {
        const dx = Math.round(p.dx * SPREAD);
        const dy = Math.round(p.dy * SPREAD);
        const style = {
          "--dx": `${dx}px`,
          "--dy": `${dy}px`,
          "--rot": `${p.rot}deg`,
          animationDelay: `${p.delay}ms`,
          background: p.color,
          width: p.size,
          height: p.size,
          ...(reduced
            ? { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${p.rot}deg)`, opacity: 0.9 }
            : {}),
        } as CSSProperties;
        return <span key={i} className={`absolute rounded-sm ${reduced ? "" : "rating-burst-particle"}`} style={style} />;
      })}
    </span>
  );
}
