import { WT_CLOCK_JUMP_MS, WT_CLOCK_MAX_AGE_MS, WT_CLOCK_WINDOW } from "@tentacle-tv/shared";

/**
 * Horloge serveur estimée depuis les pongs horodatés du socket.
 *
 * Chaque ping porte `t = Date.now()` ; le pong renvoie `t` et `serverTime`,
 * d'où `rtt = now − t` et `offset ≈ serverTime − (t + rtt/2)` — l'hypothèse
 * d'un trajet symétrique, comme NTP. L'échantillon au plus PETIT aller-retour
 * d'une fenêtre glissante est retenu (la gigue réseau n'ajoute que du retard,
 * jamais de l'avance : le plus court est le plus juste), les échantillons
 * trop vieux sont oubliés (les horloges dérivent), et un saut franc de
 * l'horloge locale (NTP, sortie de veille) vide la fenêtre — sinon le
 * « meilleur » échantillon resterait un échantillon d'avant le saut.
 */

interface ClockSample {
  offset: number;
  rtt: number;
  at: number;
}

let samples: ClockSample[] = [];

function best(now: number): ClockSample | null {
  let found: ClockSample | null = null;
  for (const s of samples) {
    if (now - s.at > WT_CLOCK_MAX_AGE_MS) continue;
    if (!found || s.rtt < found.rtt) found = s;
  }
  return found;
}

/** Enregistre un pong horodaté (`t` = instant local du ping, `serverTime` = horloge serveur). */
export function recordClockSample(t: number, serverTime: number, now: number = Date.now()): void {
  const rtt = Math.max(0, now - t);
  const offset = serverTime - (t + rtt / 2);
  const reference = best(now);
  if (reference && Math.abs(offset - reference.offset) > WT_CLOCK_JUMP_MS && rtt <= reference.rtt * 1.5 + 5) {
    samples = [];
  }
  samples.push({ offset, rtt, at: now });
  if (samples.length > WT_CLOCK_WINDOW) samples.shift();
}

/** Offset horloge serveur−client (ms), null si aucun pong horodaté récent.
 *  `serverNow ≈ Date.now() + offset`. */
export function getClockOffsetMs(now: number = Date.now()): number | null {
  return best(now)?.offset ?? null;
}

/** Aller-retour du meilleur échantillon (ms), null si aucun. */
export function getClockRttMs(now: number = Date.now()): number | null {
  return best(now)?.rtt ?? null;
}

/** Oublie tout (tests, changement de serveur). */
export function resetClockSamples(): void {
  samples = [];
}
