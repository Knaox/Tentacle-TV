import { useRef } from "react";

export interface ArmedCountdown {
  /** Temps restant à courir au moment de l'armement (ms). */
  remainingMs: number;
  /** Point de départ visuel du balayage (0-1). */
  initialProgress: number;
  /** Clé de montage — un nouvel armement remonte le balayage. */
  key: number;
}

/** Le calcul d'un armement, pur (testé). */
export function armCountdown(countdownSeconds: number, totalMs: number): ArmedCountdown {
  const remainingMs = Math.max(0, countdownSeconds * 1000);
  const total = totalMs > 0 ? totalMs : remainingMs;
  return {
    remainingMs,
    initialProgress: total > 0 ? Math.round((1 - remainingMs / total) * 1000) / 1000 : 0,
    key: total,
  };
}

/**
 * Fige le décompte AU PREMIER rendu compté — `useArmedCountdown` de l'app.
 * `countdownSeconds` décroît chaque seconde ; sans ce gel, le balayage
 * repartirait de zéro à chaque battement. L'escalade carte → affiche garde
 * ainsi sa course. `null` désarme ; un armement ultérieur refige.
 */
export function useArmedCountdown(countdownSeconds: number | null, totalMs: number): ArmedCountdown | null {
  const armedRef = useRef<ArmedCountdown | null>(null);
  if (countdownSeconds === null) {
    armedRef.current = null;
    return null;
  }
  if (!armedRef.current) armedRef.current = armCountdown(countdownSeconds, totalMs);
  return armedRef.current;
}
