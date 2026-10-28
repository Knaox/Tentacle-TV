/**
 * Une COUPURE en milieu de titre (S5 du plan du lot « Sillon recherche ») : la
 * source d'une extension s'arrête bien avant sa fin — URL directe refusée après
 * une longue pause, adresse de l'appareil changée, relais du serveur rompu. mpv
 * la prend pour une fin de fichier et passerait au titre suivant ; le moteur la
 * relit à la position (le relais local lit alors le serveur, `directRelay.ts`).
 * Une ERREUR de lecture en plein titre (trame illisible, fichier abîmé) se
 * reprend de même, quelle que soit la source. Si l'arrêt revient au même endroit
 * (un défaut DANS le fichier), la relecture saute de plus en plus loin, au-delà
 * de la zone abîmée : un blanc bref plutôt qu'un titre perdu.
 *
 * Miroir de la règle partagée du web et de l'iOS (`shared` ›
 * `octave/engine/midTrackRecovery.ts`, que le principal ne lit pas) : mêmes
 * constantes. Pur, hormis le compte par titre (`cutRecovery.test.ts`).
 */

import type { AudioBridgeSource } from "./audioBridgeContract";

/** En deçà de la durée moins cette marge, la fin d'une source d'extension est une coupure. */
export const CUT_MARGIN_MS = 2000;
/** Relectures de suite au plus (Metrolist : 3), puis la fin est tenue pour vraie. */
export const MAX_CUT_RELOADS = 3;
/** Le saut de la n-ième relecture (ms) : la position même (un flux rompu), puis au-delà d'une zone abîmée. */
export const CUT_SKIPS_MS = [0, 750, 2500] as const;
/** La lecture a avancé de tant depuis la dernière relecture : un défaut plus loin a de nouveau ses relectures. */
export const CUT_PROGRESS_MS = 10_000;

export interface CutContext {
  origin: AudioBridgeSource["origin"];
  /** Durée annoncée par la source, le titre ou mpv ; `null` si inconnue. */
  durationMs: number | null;
  positionMs: number;
  /** Relectures déjà faites pour ce titre après une coupure. */
  reloads: number;
  /** Une ERREUR de lecture (trame illisible), pas une fin : reprise quelle que soit la source. */
  error?: boolean;
}

export function isCut(ctx: CutContext): boolean {
  if ((ctx.origin !== "plugin" && ctx.error !== true) || ctx.durationMs === null || ctx.durationMs <= 0) return false;
  return ctx.positionMs > 0 && ctx.positionMs < ctx.durationMs - CUT_MARGIN_MS && ctx.reloads < MAX_CUT_RELOADS;
}

/**
 * Les relectures après coupure, comptées par titre, et la dernière position
 * JOUÉE : mpv peut retirer `time-pos` à la fin du fichier, avant que la fin ne
 * soit traitée.
 */
export class CutReloads {
  private key: string | null = null;
  private count = 0;
  private lastS: number | null = null;
  /** Où la dernière relecture a repris (s). */
  private resumedS: number | null = null;

  /** Une position jouée du titre `trackKey` (s, dans le titre). */
  played(trackKey: string, positionS: number): void {
    this.follow(trackKey);
    this.lastS = positionS;
    if (this.resumedS !== null && (positionS - this.resumedS) * 1000 >= CUT_PROGRESS_MS) {
      this.count = 0;
      this.resumedS = null;
    }
  }

  /**
   * La fin (ou l'erreur, `error`) du titre `trackKey` est-elle une coupure à relire ? Alors la relecture est
   * comptée ; rend sa position (s) — plus loin à chaque relecture au même endroit (`CUT_SKIPS_MS`).
   */
  take(trackKey: string, origin: AudioBridgeSource["origin"], durationMs: number | null, error = false): number | null {
    this.follow(trackKey);
    const positionS = this.lastS;
    if (positionS === null || durationMs === null || !isCut({ origin, durationMs, positionMs: positionS * 1000, reloads: this.count, error })) return null;
    const skipMs = CUT_SKIPS_MS[this.count] ?? 0;
    const at = Math.min(positionS + skipMs / 1000, (durationMs - CUT_MARGIN_MS) / 1000);
    this.count += 1;
    this.lastS = at;
    this.resumedS = at;
    return at;
  }

  /** Le relais a dit la source du titre coupée : relue (comptée) à la dernière position jouée, ou au début. */
  takeSignaled(trackKey: string): number | null {
    this.follow(trackKey);
    if (this.count >= MAX_CUT_RELOADS) return null;
    this.count += 1;
    return this.lastS ?? 0;
  }

  /** Un titre lancé par l'utilisateur : on repart de zéro. */
  reset(): void {
    this.key = null;
    this.count = 0;
    this.lastS = null;
    this.resumedS = null;
  }

  private follow(trackKey: string): void {
    if (trackKey === this.key) return;
    this.key = trackKey;
    this.count = 0;
    this.lastS = null;
    this.resumedS = null;
  }
}
