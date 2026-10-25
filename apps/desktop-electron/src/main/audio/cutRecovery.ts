/**
 * Une COUPURE en milieu de titre (S5 du plan du lot « Sillon recherche ») : la
 * source d'une extension s'arrête bien avant sa fin — URL directe refusée après
 * une longue pause, adresse de l'appareil changée, relais du serveur rompu. mpv
 * la prend pour une fin de fichier et passerait au titre suivant ; le moteur la
 * relit à la position (le relais local lit alors le serveur, `directRelay.ts`).
 * Pur, hormis le compte par titre (`cutRecovery.test.ts`).
 */

import type { AudioBridgeSource } from "./audioBridgeContract";

/** En deçà de la durée moins cette marge, la fin d'une source d'extension est une coupure. */
export const CUT_MARGIN_MS = 2000;
/** Relectures par titre au plus (Metrolist : 3), puis la fin est tenue pour vraie. */
export const MAX_CUT_RELOADS = 3;

export interface CutContext {
  origin: AudioBridgeSource["origin"];
  /** Durée annoncée par la source, le titre ou mpv ; `null` si inconnue. */
  durationMs: number | null;
  positionMs: number;
  /** Relectures déjà faites pour ce titre après une coupure. */
  reloads: number;
}

export function isCut(ctx: CutContext): boolean {
  if (ctx.origin !== "plugin" || ctx.durationMs === null || ctx.durationMs <= 0) return false;
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

  /** Une position jouée du titre `trackKey` (s, dans le titre). */
  played(trackKey: string, positionS: number): void {
    this.follow(trackKey);
    this.lastS = positionS;
  }

  /** La fin du titre `trackKey` est-elle une coupure à relire ? Alors la relecture est comptée ; rend sa position (s). */
  take(trackKey: string, origin: AudioBridgeSource["origin"], durationMs: number | null): number | null {
    this.follow(trackKey);
    const positionS = this.lastS;
    if (positionS === null || !isCut({ origin, durationMs, positionMs: positionS * 1000, reloads: this.count })) return null;
    this.count += 1;
    return positionS;
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
  }

  private follow(trackKey: string): void {
    if (trackKey === this.key) return;
    this.key = trackKey;
    this.count = 0;
    this.lastS = null;
  }
}
