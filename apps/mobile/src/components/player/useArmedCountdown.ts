import { useRef } from "react";

export interface ArmedCountdown {
  /** Temps restant à courir au moment de l'armement (ms). */
  remainingMs: number;
  /** Point de départ visuel du balayage (0-1). */
  initialProgress: number;
  /** Clé de montage — un nouvel armement remonte le balayage. */
  key: number;
}

/**
 * Fige le décompte AU PREMIER rendu compté — le pattern `armedRef` du desktop
 * (`NextEpisodeFullscreen.tsx`). `countdownSeconds` décroît chaque seconde ;
 * sans ce gel, le balayage repartirait de zéro à chaque tick. L'escalade
 * carte → affiche garde ainsi sa course : le balayage reprend où il en était
 * (`initialProgress`), jamais du début.
 *
 * `null` désarme (décompte annulé) ; un armement ultérieur refige.
 */
export function useArmedCountdown(
  countdownSeconds: number | null,
  totalMs: number,
): ArmedCountdown | null {
  const armedRef = useRef<ArmedCountdown | null>(null);

  if (countdownSeconds === null) {
    armedRef.current = null;
    return null;
  }
  if (!armedRef.current) {
    const remainingMs = Math.max(0, countdownSeconds * 1000);
    const total = totalMs > 0 ? totalMs : remainingMs;
    armedRef.current = {
      remainingMs,
      initialProgress:
        total > 0 ? Math.round((1 - remainingMs / total) * 1000) / 1000 : 0,
      key: total,
    };
  }
  return armedRef.current;
}
