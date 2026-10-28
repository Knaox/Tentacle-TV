/**
 * Octave — un titre qui s'interrompt AU MILIEU (flux rompu, trame illisible, fichier tronqué) ne s'arrête pas
 * et ne passe pas au suivant : le moteur le reprend là où il en était. Si l'interruption se répète au même
 * endroit (un défaut DANS le fichier), la reprise saute de plus en plus loin, au-delà de la zone abîmée — un
 * blanc bref plutôt qu'une erreur ou un titre perdu. Une fin à moins de `RECOVERY_MARGIN_MS` de la durée
 * annoncée est la vraie fin.
 *
 * La règle des trois lecteurs : le web l'applique telle quelle (`htmlAudioEngine.ts`), l'iOS en recopie les
 * constantes (`octave-audio/ios/MidTrackRecovery.swift`), le bureau aussi (`desktop-electron` ›
 * `audio/cutRecovery.ts`, qui ne lit pas `shared`). Pur (`midTrackRecovery.test.ts`).
 */

/** Une interruption à moins de tant de la durée annoncée est la vraie fin du titre. */
export const RECOVERY_MARGIN_MS = 2000;
/** Reprises de suite au plus, au même endroit. */
export const MAX_RECOVERIES = 3;
/** Le saut de la n-ième reprise : la position même (un flux rompu), puis au-delà d'une zone abîmée. */
export const RECOVERY_SKIPS_MS = [0, 1000, 6000] as const;
/** La lecture a avancé de tant depuis la dernière reprise : un défaut plus loin a de nouveau ses reprises. */
export const RECOVERY_PROGRESS_MS = 10_000;

/** Où reprendre (ms), ou `null` : vraie fin, durée inconnue, rien joué encore, ou reprises épuisées. */
export function recoveryStartMs(positionMs: number, durationMs: number | null, attempts: number): number | null {
  if (durationMs === null || !(durationMs > 0) || !(positionMs > 0)) return null;
  if (attempts >= MAX_RECOVERIES || positionMs >= durationMs - RECOVERY_MARGIN_MS) return null;
  const skip = RECOVERY_SKIPS_MS[attempts] ?? 0;
  return Math.min(positionMs + skip, durationMs - RECOVERY_MARGIN_MS);
}

/** Les reprises d'un titre : la dernière position JOUÉE et le compte, remis à zéro par un autre titre ou un progrès net. */
export class MidTrackRecovery {
  private key: string | null = null;
  private attempts = 0;
  private lastMs: number | null = null;
  private resumedAt: number | null = null;

  /** Une position jouée du titre `trackKey` (ms). */
  played(trackKey: string, positionMs: number): void {
    this.follow(trackKey);
    if (!(positionMs > 0)) return;
    this.lastMs = positionMs;
    if (this.resumedAt !== null && positionMs - this.resumedAt >= RECOVERY_PROGRESS_MS) {
      this.attempts = 0;
      this.resumedAt = null;
    }
  }

  /** Le titre s'est interrompu : où le reprendre (la reprise est comptée), ou `null`. */
  take(trackKey: string, durationMs: number | null): number | null {
    this.follow(trackKey);
    const at = this.lastMs === null ? null : recoveryStartMs(this.lastMs, durationMs, this.attempts);
    if (at === null) return null;
    this.attempts += 1;
    this.resumedAt = at;
    this.lastMs = at;
    return at;
  }

  /** Un titre lancé ou repositionné par l'utilisateur : tout repart de zéro. */
  reset(): void {
    this.key = null;
    this.attempts = 0;
    this.lastMs = null;
    this.resumedAt = null;
  }

  private follow(trackKey: string): void {
    if (trackKey === this.key) return;
    this.reset();
    this.key = trackKey;
  }
}
