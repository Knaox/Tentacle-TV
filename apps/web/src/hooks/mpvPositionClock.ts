/**
 * La position de mpv « maintenant », extrapolée entre deux `time-pos`.
 *
 * `time-pos` arrive étranglé à 8 Hz, horodaté côté processus principal à
 * l'instant de sa lecture dans la file de mpv — donc avec la gigue du pompage
 * (20 ms). Chaque échantillon donne une base `pos − (at/1000) × vitesse` ; la
 * MÉDIANE des trois dernières absorbe la gigue, et la position à l'instant t
 * vaut `base + (t/1000) × vitesse`. Un changement de vitesse ou un seek rend
 * les bases incomparables : on repart de zéro.
 */

export const POSITION_CLOCK_SAMPLES = 3;
/** Au-delà, l'extrapolation ment (lecteur figé sans le dire) : on la plafonne. */
export const POSITION_CLOCK_MAX_EXTRAPOLATION_S = 0.4;

export interface PositionClock {
  /** Un nouvel échantillon `time-pos` (secondes de flux) mesuré à `at` (Date.now()). */
  push(positionS: number, at: number, speed: number): void;
  /** Position de flux estimée à `now` — `null` sans échantillon. */
  estimate(now: number): number | null;
  reset(): void;
}

export function createPositionClock(): PositionClock {
  let bases: number[] = [];
  let lastAt = 0;
  let lastPosition = 0;
  let currentSpeed = 1;

  return {
    push(positionS, at, speed) {
      if (at === lastAt && positionS === lastPosition) return;
      if (speed !== currentSpeed) { bases = []; currentSpeed = speed; }
      lastAt = at;
      lastPosition = positionS;
      bases.push(positionS - (at / 1000) * speed);
      if (bases.length > POSITION_CLOCK_SAMPLES) bases.shift();
    },
    estimate(now) {
      if (bases.length === 0) return null;
      const sorted = [...bases].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      const elapsedS = Math.min(Math.max(0, now - lastAt) / 1000, POSITION_CLOCK_MAX_EXTRAPOLATION_S);
      // La médiane vaut pour `lastAt` ; au-delà, on n'avance que d'un pas borné.
      return median + (lastAt / 1000) * currentSpeed + elapsedS * currentSpeed;
    },
    reset() {
      bases = [];
      lastAt = 0;
      lastPosition = 0;
    },
  };
}
