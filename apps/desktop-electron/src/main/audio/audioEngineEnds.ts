/**
 * Les FINS de fichier du moteur, sorties de `audioEngine.ts` :
 * - vraie fin : le suivant retenu part, ou la lecture s'arrête ;
 * - fin PROVISOIRE d'un fichier qui grandit : relue à la position après un délai
 *   (`partialSource.ts`) ;
 * - COUPURE en milieu de titre d'une source d'extension : relue aussitôt à la
 *   position (`cutRecovery.ts`). mpv passe seul au suivant sur la fin d'un
 *   fichier qui n'est pas le dernier : une coupure se reprend dès `END_FILE`.
 *   Le relais local DIT aussi la coupure d'un flux direct (`sourceCut`) : relue
 *   aussitôt, sans attendre que mpv abandonne.
 */

import { durationOf, type EngineFlags, type LiveProps } from "./audioEngineState";
import { ProvisionalEnd } from "./audioEngineTimers";
import type { AudioQueue, QueueEntry, QueueResult } from "./audioQueue";
import { CutReloads } from "./cutRecovery";
import { isRealEnd } from "./partialSource";

/** Pourquoi mpv a fini un fichier (`END_REASON` de `audioMpv.ts`, traduit par le moteur). */
export type EndKind = "eof" | "error" | "other";

/** Ce que les fins lisent et pilotent du moteur. */
export interface EndsHost {
  readonly queue: AudioQueue;
  props(): LiveProps;
  flags(): EngineFlags;
  /** La position dans le TITRE (s). */
  positionS(): number;
  /** Une bascule attend son instant T : la fin posée sur le fichier en cours n'est pas une coupure. */
  swapScheduled(): boolean;
  run(result: QueueResult): void;
  fail(message: string, entry: QueueEntry): void;
  /** La vraie fin du dernier titre : plus rien à jouer. */
  stopAtEnd(): void;
  emitState(): void;
}

export class FileEnds {
  readonly provisional = new ProvisionalEnd();
  readonly cuts = new CutReloads();
  /** Sources dites coupées par le relais avant d'être en cours (un suivant préchargé) : relues quand elles jouent. */
  private readonly signaled = new Set<string>();

  constructor(private readonly host: EndsHost) {}

  /** Une position jouée du titre en cours (la coupure se relit là, même si mpv retire `time-pos`). */
  played(): void {
    const current = this.host.queue.current();
    if (current === null) return;
    this.cuts.played(current.track.trackKey, this.host.positionS());
    if (this.signaled.delete(current.source.url)) this.reloadSignaled(current);
  }

  /** Le relais local dit la source `url` coupée (direct refusé en pleine lecture). */
  sourceCut(url: string): void {
    const current = this.host.queue.current();
    if (current !== null && current.source.url === url && this.host.queue.isStarted()) this.reloadSignaled(current);
    else this.signaled.add(url);
  }

  /** mpv a fini un fichier de la liste : une coupure se reprend, une erreur se signale. */
  endFile(mpvId: number, kind: EndKind, error: number): void {
    const current = this.host.queue.current();
    if (current === null || current.mpvId !== mpvId) return;
    if (kind !== "other" && this.reloadCut(current, kind === "error")) return;
    if (kind === "error") this.host.fail(`end-file ${error}`, current);
  }

  /** mpv tient la fin du dernier fichier (`keep-open`) : vraie fin, provisoire, ou coupure ? */
  eof(): void {
    const { queue } = this.host;
    const current = queue.current();
    if (current === null || !queue.isStarted() || this.host.flags().awaitingRestart || this.provisional.pending()) return;
    const real = isRealEnd({
      complete: current.source.complete,
      durationMs: durationOf(current, this.host.props()),
      positionMs: this.host.positionS() * 1000,
      stalledReloads: this.provisional.stalledReloads(),
    });
    if (!real) {
      this.host.flags().reloading = true;
      this.provisional.schedule(
        () => queue.current() === current && this.host.props().eofReached,
        () => this.host.positionS() * 1000,
        (positionS) => this.host.run(queue.reload(positionS)),
      );
      this.host.emitState();
      return;
    }
    if (this.reloadCut(current)) return;
    const next = queue.advanceHeld();
    if (next !== null) this.host.run(next);
    else this.host.stopAtEnd();
  }

  clearReload(): void {
    this.provisional.cancel();
    this.host.flags().reloading = false;
  }

  /** Une coupure dite par le relais : relue à la position — avec la source d'une bascule en attente, s'il y en a une. */
  private reloadSignaled(current: QueueEntry): void {
    const { queue } = this.host;
    const at = this.cuts.takeSignaled(current.track.trackKey);
    if (at === null) return;
    console.warn(`[audio] source coupée à ${at.toFixed(1)} s (relais) : relue à la position`);
    this.host.run(queue.pendingSwap() !== null ? queue.seek(at) : queue.reload(at));
  }

  /** Une coupure (ou une erreur de lecture) en milieu de titre : relue à la position, au lieu de passer au suivant. */
  private reloadCut(current: QueueEntry, error = false): boolean {
    const { queue } = this.host;
    if (!queue.isStarted() || this.host.swapScheduled() || queue.pendingSwap() !== null) return false;
    const at = this.cuts.take(current.track.trackKey, current.source.origin, durationOf(current, this.host.props()), error);
    if (at === null) return false;
    console.warn(`[audio] coupure à ${at.toFixed(1)} s : relue à la position`);
    this.host.run(queue.reload(at));
    return true;
  }
}
