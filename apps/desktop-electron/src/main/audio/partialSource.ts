/**
 * La fin d'un fichier ENCORE EN ÉCRITURE (`complete: false`) : vraie fin, ou
 * fin provisoire à relire ? Pur (`partialSource.test.ts`).
 *
 * ffmpeg se reconnecte déjà de lui-même à la fin provisoire
 * (`reconnect_at_eof`, `audioOptions.ts`) ; quand il abandonne quand même — le
 * fichier n'a pas grandi pendant son délai —, mpv s'arrête sur la fin
 * (`keep-open`) et c'est ici qu'on décide : relire à la position, ou tenir la
 * fin pour vraie et passer au suivant.
 */

/** En deçà de la durée annoncée moins cette marge, une fin est provisoire. */
export const PARTIAL_END_TOLERANCE_MS = 1500;
/** Relectures SANS progrès au-delà desquelles une fin sans durée connue est vraie. */
export const MAX_STALLED_RELOADS = 4;
/** Délais entre deux relectures : le fichier a le temps de grandir. */
const RELOAD_DELAYS_MS = [250, 600, 1200, 2500] as const;

export interface EndContext {
  complete: boolean;
  /** Durée annoncée par la source ou le titre ; `null` si inconnue. */
  durationMs: number | null;
  positionMs: number;
  /** Relectures enchaînées sans que la position ait avancé. */
  stalledReloads: number;
}

export function isRealEnd(ctx: EndContext): boolean {
  if (ctx.complete) return true;
  if (ctx.durationMs !== null && ctx.durationMs > 0) {
    if (ctx.positionMs >= ctx.durationMs - PARTIAL_END_TOLERANCE_MS) return true;
    // Une durée annoncée qui ne vient jamais (fichier tronqué pour de bon) :
    // on ne relit pas éternellement.
    return ctx.stalledReloads >= MAX_STALLED_RELOADS * 2;
  }
  return ctx.stalledReloads >= MAX_STALLED_RELOADS;
}

/**
 * Le fichier en écriture est-il ENTIER dans le cache de mpv ? Alors sa fin est
 * la vraie, et le suivant retenu peut être confié à mpv pour un enchaînement
 * sans blanc — au lieu d'un rechargement à la fin, qui coupait les ~300 ms
 * encore dans la sortie (mesuré en temps réel).
 */
export function cachedToEnd(cacheTimeS: number | null, offsetS: number, durationMs: number | null): boolean {
  if (cacheTimeS === null || durationMs === null || durationMs <= 0) return false;
  return (cacheTimeS + offsetS) * 1000 >= durationMs - 250;
}

export function reloadDelayMs(attempt: number): number {
  const index = Math.min(Math.max(attempt, 0), RELOAD_DELAYS_MS.length - 1);
  return RELOAD_DELAYS_MS[index] ?? 2500;
}

/** La position a-t-elle avancé depuis la dernière relecture (au-delà du bruit) ? */
export function progressed(previousMs: number | null, positionMs: number): boolean {
  return previousMs === null || positionMs > previousMs + 200;
}
