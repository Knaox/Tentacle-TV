/**
 * Le MODÈLE de la liste de lecture de mpv, pur (`audioQueue.test.ts`) : chaque
 * geste rend les commandes à envoyer, dans l'ordre, et ce qu'il faut annoncer.
 * La liste a toujours la forme [ en cours, (bascule), (suivant) ].
 *
 * - Le SUIVANT est ajouté en fin de liste : `prefetch-playlist` l'ouvre
 *   d'avance et `gapless-audio` l'enchaîne sans un échantillon de blanc
 *   (mesuré bit pour bit au banc).
 * - La BASCULE À CHAUD (`swapSource` du titre en cours) ne coupe rien : la fin
 *   du fichier en cours est posée à un instant T un peu devant
 *   (`file-local-options/end`), et la nouvelle source est insérée juste après
 *   en EDL qui COMMENCE à T (`edl://…,start=T`). mpv passe de l'une à l'autre
 *   comme d'un titre au suivant d'un album : sans blanc, à l'échantillon près.
 *   ⚠️ Jamais `start=T` sur l'entrée : ce départ est un SAUT, qui vide la
 *   sortie — échantillons continus en PCM, mais 230 à 310 ms de trou mesurés
 *   en temps réel. L'EDL décale la chronologie à l'ouverture, sans saut ; sa
 *   position part de 0 (`edlFromS` la recale).
 * - Tant que le titre en cours est INCOMPLET (fichier qui grandit), le suivant
 *   est RETENU hors de mpv : sinon la fin provisoire du fichier ferait passer
 *   au titre suivant au milieu d'une chanson.
 *
 * Identifiants : mpv numérote chaque entrée ajoutée (1, 2, 3…, rendus par
 * `START_FILE`) ; seul ce moteur en ajoute à SON cœur, on les PRÉVOIT donc.
 * Un ajout refusé décale la suite : `loadFailed` la recale.
 */

import type { AudioBridgeSource, AudioBridgeTrack } from "./audioBridgeContract";

/**
 * Ce que le départ d'une entrée veut dire :
 * - `start` : un `play()` — rien à annoncer ;
 * - `advance` : le titre suivant — `advanced` ;
 * - `swap` : la nouvelle source du même titre — `swapped` ;
 * - `reload` : la même source relue (fin provisoire) — rien.
 */
export type EntryKind = "start" | "advance" | "swap" | "reload";

export interface QueueEntry {
  mpvId: number;
  kind: EntryKind;
  track: AudioBridgeTrack;
  source: AudioBridgeSource;
  startS: number | null;
  /** Clés d'album voisines, pour le ReplayGain « auto ». */
  neighbours: Array<string | null>;
  /** Le titre qu'une entrée `advance` remplace : `fromKey` de `advanced`. */
  fromKey: string | null;
  /** Entrée EDL d'une bascule : sa position 0 est cet instant du titre (s). */
  edlFromS: number | null;
}

/** Où la chronologie de l'entrée commence dans le titre (s). */
export const offsetOf = (entry: QueueEntry | null): number => entry?.edlFromS ?? 0;

export type QueueOp =
  | { op: "load"; mode: "replace" | "append" | "insert-next"; entry: QueueEntry }
  | { op: "remove"; index: number }
  | { op: "setEnd"; seconds: number }
  | { op: "clearEnd" }
  | { op: "seek"; seconds: number }
  | { op: "stop" };

export type QueueNotice =
  | { type: "advanced"; fromKey: string | null; toKey: string | null }
  | { type: "swapped"; trackKey: string; origin: AudioBridgeSource["origin"] };

export interface QueueResult {
  ops: QueueOp[];
  notices: QueueNotice[];
}

/** Ce que le moteur sait de la lecture au moment d'une bascule. */
export interface SwapContext {
  positionS: number;
  /** Lecture lancée (premier `START_FILE` reçu) ? */
  started: boolean;
  /** Arrêtée sur une fin (vraie ou provisoire) ? */
  atEnd: boolean;
  /** Le point de bascule calculé (`swapPoint`), ou `null` s'il n'y a plus la place. */
  swapAtS: number | null;
}

interface Pending {
  track: AudioBridgeTrack;
  source: AudioBridgeSource;
}

const empty = (): QueueResult => ({ ops: [], notices: [] });

export class AudioQueue {
  private entries: QueueEntry[] = [];
  /** Le suivant demandé mais pas encore confié à mpv. */
  private held: Pending | null = null;
  private idAlloc = 0;
  /** L'entrée qui joue a-t-elle commencé (`START_FILE`) ? */
  private started = false;

  current = (): QueueEntry | null => this.entries[0] ?? null;
  isStarted = (): boolean => this.started;

  /** La source de bascule insérée, en attente de son instant T. */
  pendingSwap(): QueueEntry | null {
    const second = this.entries[1];
    return second !== undefined && second.kind === "swap" ? second : null;
  }

  /** Le titre suivant : dans mpv, ou retenu. */
  nextTrack(): Pending | null {
    const appended = this.entries.find((e, i) => i > 0 && e.kind !== "swap");
    return appended !== undefined ? { track: appended.track, source: appended.source } : this.held;
  }

  private make(kind: EntryKind, track: AudioBridgeTrack, source: AudioBridgeSource, startS: number | null, neighbours: Array<string | null>): QueueEntry {
    this.idAlloc += 1;
    const fromKey = kind === "advance" ? this.entries[this.entries.length - 1]?.track.trackKey ?? null : null;
    return { mpvId: this.idAlloc, kind, track, source, startS, neighbours, fromKey, edlFromS: null };
  }

  /** Le suivant retenu part dans mpv dès que ce qui le précède est complet. */
  private flushHeld(result: QueueResult): void {
    const last = this.entries[this.entries.length - 1];
    if (this.held === null || last === undefined || !last.source.complete) return;
    if (this.entries.some((e, i) => i > 0 && e.kind !== "swap")) return;
    const { track, source } = this.held;
    this.held = null;
    const entry = this.make("advance", track, source, null, [last.track.albumKey]);
    this.entries.push(entry);
    result.ops.push({ op: "load", mode: "append", entry });
  }

  /** Retire de mpv le suivant déjà confié (toujours en fin de liste). */
  private dropAppendedNext(result: QueueResult): void {
    const index = this.entries.findIndex((e, i) => i > 0 && e.kind !== "swap");
    if (index < 0) return;
    this.entries.splice(index, 1);
    result.ops.push({ op: "remove", index });
  }

  /** `loadfile replace` VIDE la liste de mpv : le suivant est retenu puis remis. */
  private replaceWith(kind: EntryKind, track: AudioBridgeTrack, source: AudioBridgeSource, startS: number | null): QueueResult {
    const result = empty();
    const next = this.nextTrack();
    this.held = next;
    const before = kind === "advance" ? this.entries[0]?.track.albumKey ?? null : null;
    const entry = this.make(kind, track, source, startS, [before, next?.track.albumKey ?? null]);
    if (kind === "advance") entry.fromKey = this.entries[0]?.track.trackKey ?? null;
    this.entries = [entry];
    this.started = false;
    result.ops.push({ op: "load", mode: "replace", entry });
    this.flushHeld(result);
    return result;
  }

  play(track: AudioBridgeTrack, source: AudioBridgeSource, startS: number | null): QueueResult {
    this.held = null;
    this.entries = [];
    return this.replaceWith("start", track, source, startS);
  }

  setNext(track: AudioBridgeTrack | null, source: AudioBridgeSource | null): QueueResult {
    const result = empty();
    this.dropAppendedNext(result);
    this.held = track !== null && source !== null ? { track, source } : null;
    this.flushHeld(result);
    return result;
  }

  stop(): QueueResult {
    this.entries = [];
    this.held = null;
    this.started = false;
    return { ops: [{ op: "stop" }], notices: [] };
  }

  /**
   * Bascule la source d'un titre. Rend `null` si le titre n'est ni le courant
   * ni le suivant : le moteur la garde pour plus tard.
   */
  swap(trackKey: string, source: AudioBridgeSource, ctx: SwapContext): QueueResult | null {
    if (this.held !== null && this.held.track.trackKey === trackKey) {
      this.held = { track: this.held.track, source };
      const result = empty();
      this.flushHeld(result);
      return result;
    }
    const nextIndex = this.entries.findIndex((e, i) => i > 0 && e.kind !== "swap" && e.track.trackKey === trackKey);
    if (nextIndex > 0) {
      const result = empty();
      const [old] = this.entries.splice(nextIndex, 1);
      result.ops.push({ op: "remove", index: nextIndex });
      if (old !== undefined) this.held = { track: old.track, source };
      this.flushHeld(result);
      return result;
    }
    const current = this.current();
    if (current === null || current.track.trackKey !== trackKey) return null;
    return this.swapCurrent(current, source, ctx);
  }

  private swapCurrent(current: QueueEntry, source: AudioBridgeSource, ctx: SwapContext): QueueResult {
    // Pas encore lancé, ou arrêté sur une fin : rien n'est audible, on relit
    // simplement la nouvelle source à la position.
    if (!ctx.started || ctx.atEnd) {
      return this.replaceWith("swap", current.track, source, ctx.started ? ctx.positionS : current.startS);
    }
    const result = empty();
    const pending = this.pendingSwap();
    if (pending !== null) {
      this.entries.splice(1, 1);
      result.ops.push({ op: "remove", index: 1 });
    }
    // Plus la place de basculer avant la fin du titre : la source change pour
    // les relectures, le son ne bouge pas.
    if (ctx.swapAtS === null) {
      if (pending !== null) result.ops.push({ op: "clearEnd" });
      current.source = source;
      result.notices.push({ type: "swapped", trackKey: current.track.trackKey, origin: source.origin });
      this.flushHeld(result);
      return result;
    }
    const entry = this.make("swap", current.track, source, null, current.neighbours);
    entry.edlFromS = ctx.swapAtS;
    this.entries.splice(1, 0, entry);
    result.ops.push({ op: "setEnd", seconds: ctx.swapAtS - offsetOf(current) });
    result.ops.push({ op: "load", mode: "insert-next", entry });
    // Un suivant retenu (titre incomplet) part derrière la nouvelle source.
    this.flushHeld(result);
    return result;
  }

  /**
   * Un saut. Pendant une bascule en attente, le saut EST la bascule : la
   * nouvelle source est relue à la cible (le saut s'entend de toute façon).
   */
  seek(positionS: number): QueueResult {
    const pending = this.pendingSwap();
    const current = this.current();
    if (pending !== null && current !== null) {
      this.entries.splice(1, 1);
      return this.replaceWith("swap", current.track, pending.source, positionS);
    }
    // Une entrée EDL ne remonte pas avant son début : on relit la source.
    if (current !== null && positionS < offsetOf(current)) return this.replaceWith("reload", current.track, current.source, positionS);
    return { ops: [{ op: "seek", seconds: positionS - offsetOf(current) }], notices: [] };
  }

  /** Le fichier en écriture est tout entier en cache : le suivant retenu peut partir sans blanc. */
  markCurrentComplete(): QueueResult {
    const result = empty();
    const current = this.current();
    if (current === null || current.source.complete) return result;
    current.source = { ...current.source, complete: true };
    this.flushHeld(result);
    return result;
  }

  /** Relit la source en cours à la position (fin provisoire d'un fichier qui grandit). */
  reload(positionS: number): QueueResult {
    const current = this.current();
    if (current === null) return empty();
    return this.replaceWith("reload", current.track, current.source, positionS);
  }

  /** Vraie fin du titre en cours, le suivant RETENU : il part maintenant. */
  advanceHeld(): QueueResult | null {
    if (this.held === null) return null;
    const { track, source } = this.held;
    this.held = null;
    return this.replaceWith("advance", track, source, null);
  }

  /** mpv a ouvert l'entrée `mpvId`. `null` : entrée inconnue (le moteur se recale). */
  startFile(mpvId: number): QueueResult | null {
    const index = this.entries.findIndex((e) => e.mpvId === mpvId);
    if (index < 0) return null;
    const result = empty();
    const entry = this.entries[index] as QueueEntry;
    if (entry.kind === "swap") {
      result.notices.push({ type: "swapped", trackKey: entry.track.trackKey, origin: entry.source.origin });
    } else if (entry.kind === "advance") {
      result.notices.push({ type: "advanced", fromKey: entry.fromKey, toKey: entry.track.trackKey });
    }
    // L'entrée joue : c'est désormais un titre comme un autre.
    entry.kind = "start";
    for (let i = 0; i < index; i += 1) result.ops.push({ op: "remove", index: 0 });
    this.entries = this.entries.slice(index);
    this.started = true;
    this.flushHeld(result);
    return result;
  }

  /** mpv a refusé l'ajout `mpvId` : il n'a rien numéroté, la suite se recale. */
  loadFailed(mpvId: number): void {
    this.entries = this.entries.filter((e) => e.mpvId !== mpvId);
    for (const e of this.entries) if (e.mpvId > mpvId) e.mpvId -= 1;
    this.idAlloc -= 1;
  }
}
