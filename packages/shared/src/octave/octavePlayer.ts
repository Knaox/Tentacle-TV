/**
 * Octave — le contrôleur de lecture : la FILE est ici, le moteur
 * (`AudioEnginePort`) ne reçoit que le titre courant et le suivant.
 *
 * Attente invisible : un clic pose AUSSITÔT le titre, la pochette et « Pause »
 * dans la barre (instantané émis de façon synchrone, avant toute requête), la
 * progression reste à zéro jusqu'au son, et aucune vue n'attend. Le moteur ne
 * reçoit `play` qu'une fois la source connue — souvent déjà prête, grâce à
 * l'anticipation (`prefetch`).
 *
 * Les gestes de file (aléatoire, retrait…) sont dans `octaveQueueActions.ts` ;
 * la bascule d'un titre résolu dans `octaveResolution.ts`.
 */

import type { AudioEnginePort, EngineEvent, EngineState, MusicTrack, PrefetchIntent } from "../music";
import { advance, createQueue, currentItem, peekNext, previous, type QueueItem, type QueueState, type Random } from "./queueModel";
import { enginePhase, INITIAL_POSITION, INITIAL_SNAPSHOT, ValueStore, type PlayerSnapshot, type PositionState } from "./playerState";
import type { PlaybackReporter } from "./playbackReports";
import type { SourceCache, SourceIntent } from "./sourceCache";
import { FailureStreak } from "./failureStreak";
import { refreshEngineSource } from "./octaveResolution";
import { waitForSource } from "./sourceRetry";
import { CHOSEN_BUDGET_TRIES, type StartCause } from "./startCause";
import { queueActions } from "./octaveQueueActions";
import { applyRemoteCommand } from "./remoteCommands";
import { engineLostCurrent } from "./engineLoss";

export interface OctavePlayerDeps {
  engine: AudioEnginePort;
  sources: SourceCache;
  reporter: PlaybackReporter;
  /** Conseil d'anticipation aux extensions (titres externes seulement). */
  prefetchExternal: (tracks: readonly MusicTrack[], intent: PrefetchIntent) => void;
  random?: Random;
  /** Après un titre sans source, on passe au suivant au bout de ce délai. */
  skipDelayMs?: number;
}

export class OctavePlayer {
  readonly snapshot = new ValueStore<PlayerSnapshot>(INITIAL_SNAPSHOT);
  readonly position = new ValueStore<PositionState>(INITIAL_POSITION);
  /** La clé que le MOTEUR connaît pour une entrée (elle survit à une résolution). */
  readonly engineKeys = new Map<string, string>();
  /** L'entrée préchargée comme « suivante » dans le moteur. */
  nextUid: string | null = null;
  /** … et sa source est la copie gardée : l'enchaînement sans blanc le dira (`fromDevice`). */
  nextFromDevice = false;
  /** Une session quittée, REPRISE en pause (`octaveResume.ts`) : rien de chargé, « Lecture » la démarre à cette position. */
  restoredAtMs: number | null = null;
  /** Le suivant attend que le courant SONNE : préchargé plus tôt, il disputait au courant l'ouverture (mpv, mesuré). */
  private nextAfterStart = false;
  private playToken = 0;
  /** Les titres sans source d'affilée : au 3e, plus de passage automatique (`failureStreak.ts`). */
  private readonly failures = new FailureStreak();
  private readonly unsubscribe: () => void;

  constructor(readonly deps: OctavePlayerDeps) {
    const state = deps.engine.getState();
    this.snapshot.update({ volume: state.volume, muted: state.muted });
    this.unsubscribe = deps.engine.subscribe((event) => this.onEngine(event));
  }

  dispose(): void {
    this.unsubscribe();
    this.stop();
  }

  get random(): Random {
    return this.deps.random ?? Math.random;
  }

  /* ── Lancer ── */

  /** Lit `tracks` à partir de `index` — la barre est à jour AVANT le retour de cette fonction. */
  playList(tracks: readonly MusicTrack[], index: number, contextId: string | null = null): void {
    this.failures.reset();
    const { shuffle, repeat } = this.snapshot.get().queue;
    const queue = createQueue(tracks, index, { shuffle, repeat, contextId, random: this.random });
    this.startItem(queue, 0);
  }

  /** Démarre l'entrée courante de `queue` à `startMs` — choisie par l'utilisateur, sauf mention contraire. */
  startItem(queue: QueueState, startMs: number, cause: StartCause = "chosen", intent: SourceIntent = "play"): void {
    const item = currentItem(queue);
    const before = this.snapshot.get();
    if (before.current) this.deps.reporter.stopped(this.position.get().positionMs, this.position.get().durationMs);
    if (!item) return this.stop();
    const token = ++this.playToken;
    this.restoredAtMs = null;
    // 1 · L'instantané d'abord : titre, pochette et « Pause », dans la même image que le clic.
    this.snapshot.update({
      queue,
      current: item.track,
      wantsPlay: true,
      phase: "starting",
      durationMs: item.track.durationMs,
      format: item.track.format,
      origin: null,
      fromDevice: false,
      error: null,
      notice: null,
    });
    this.position.set({ positionMs: startMs, durationMs: item.track.durationMs, running: false });
    this.nextUid = null;
    // 2 · La source : prête (anticipée) → le moteur part tout de suite ; sinon dès qu'elle arrive.
    const ready = this.deps.sources.peek(item.track.key);
    if (ready) {
      this.launch(item, ready, startMs);
      return;
    }
    // Sinon : avis s'il tarde, nouveaux essais si le budget de l'extension l'exige (`sourceRetry.ts`).
    waitForSource(this.deps.sources, item.track, {
      intent,
      tries: cause === "chosen" ? CHOSEN_BUDGET_TRIES : 1,
      current: () => token === this.playToken,
      notice: (notice) => this.snapshot.update({ notice }),
      done: (source) => (source ? this.launch(item, source, startMs) : this.failCurrent(token, cause)),
    });
  }

  private launch(item: QueueItem, source: Parameters<AudioEnginePort["play"]>[1], startMs: number): void {
    this.engineKeys.set(item.uid, item.track.key);
    this.snapshot.update({
      origin: source.origin,
      fromDevice: source.kept !== undefined,
      format: source.format ?? item.track.format,
      durationMs: source.durationMs ?? item.track.durationMs,
    });
    this.deps.engine.play(item.track, source, startMs);
    if (!this.snapshot.get().wantsPlay) this.deps.engine.pause();
    this.nextAfterStart = true;
  }

  /** Aucune source : on le dit ; un titre CHOISI reste là, l'enchaînement passe au suivant (deux fois d'affilée au plus). */
  private failCurrent(token: number, cause: StartCause): void {
    // Rien ne joue : le bouton redevient « Lecture » (qui vaut « Réessayer »).
    this.snapshot.update({ phase: "error", error: "noSource", notice: null, wantsPlay: false });
    if (cause !== "chained" || !this.failures.failed()) return;
    const delay = this.deps.skipDelayMs ?? 1_500;
    setTimeout(() => {
      if (token !== this.playToken) return;
      const moved = advance(this.snapshot.get().queue, false);
      if (moved && moved.cursor !== this.snapshot.get().queue.cursor) this.startItem(moved, 0, "chained");
    }, delay);
  }

  /** Donne au moteur le suivant de la file (préchargement sans blanc), et l'annonce à l'extension. */
  scheduleNext(): void {
    if (this.restoredAtMs !== null) return; // rien ne joue encore : le suivant viendra au démarrage
    const queue = this.snapshot.get().queue;
    const next = peekNext(queue, true);
    const token = this.playToken;
    if (!next) {
      this.nextUid = null;
      this.deps.engine.setNext(null, null);
      return;
    }
    this.deps.prefetchExternal([next.track], "next");
    const ready = this.deps.sources.peek(next.track.key);
    const hand = (source: Parameters<AudioEnginePort["setNext"]>[1]) => {
      if (token !== this.playToken || !source) return;
      this.nextUid = next.uid;
      this.nextFromDevice = source.kept !== undefined;
      this.engineKeys.set(next.uid, next.track.key);
      this.deps.engine.setNext(next.track, source);
    };
    if (ready) hand(ready);
    else void this.deps.sources.get(next.track, "next").then(hand);
  }

  /* ── Transport ── */

  togglePlay(): void {
    if (this.snapshot.get().wantsPlay) this.pause();
    else this.resume();
  }

  pause(): void {
    this.snapshot.update({ wantsPlay: false, phase: this.snapshot.get().phase === "starting" ? "starting" : "paused" });
    this.position.update({ running: false });
    this.deps.engine.pause();
    this.deps.reporter.paused(this.position.get().positionMs);
  }

  resume(): void {
    const snap = this.snapshot.get();
    if (!snap.current) return;
    if (snap.phase === "error") return queueActions.retry(this);
    if (snap.phase === "ended" || this.restoredAtMs !== null) return this.startItem(snap.queue, this.restoredAtMs ?? 0);
    // Le moteur a perdu le titre pendant l'absence de l'app (`engineLoss.ts`) : redonné à sa position.
    if (engineLostCurrent(this)) return this.startItem(snap.queue, this.position.get().positionMs);
    this.snapshot.update({ wantsPlay: true });
    this.deps.engine.resume();
  }

  next(): void {
    this.failures.reset();
    const moved = advance(this.snapshot.get().queue, false);
    if (moved) this.startItem(moved, 0);
  }

  previous(): void {
    const outcome = previous(this.snapshot.get().queue, this.position.get().positionMs);
    if (outcome.kind === "restart") this.seek(0);
    else this.startItem(outcome.queue, 0);
  }

  seek(positionMs: number): void {
    const clamped = Math.max(0, positionMs);
    this.position.update({ positionMs: clamped });
    if (this.restoredAtMs !== null) this.restoredAtMs = clamped;
    else this.deps.engine.seek(clamped);
  }

  setVolume(volume: number): void {
    const v = Math.min(1, Math.max(0, volume));
    this.snapshot.update({ volume: v, muted: v === 0 ? this.snapshot.get().muted : false });
    this.deps.engine.setVolume(v);
    if (v > 0 && this.snapshot.get().muted) this.deps.engine.setMuted(false);
  }

  toggleMute(): void {
    const muted = !this.snapshot.get().muted;
    this.snapshot.update({ muted });
    this.deps.engine.setMuted(muted);
  }

  stop(): void {
    this.playToken += 1;
    this.restoredAtMs = null;
    this.deps.reporter.stopped(this.position.get().positionMs, this.position.get().durationMs);
    this.deps.engine.stop();
    this.nextUid = null;
    this.snapshot.update({ current: null, wantsPlay: false, phase: "idle", origin: null, fromDevice: false, error: null, notice: null });
    this.position.set(INITIAL_POSITION);
  }

  /** Anticipation : prépare les sources (appui, suivant) et prévient l'extension. */
  prefetch(tracks: readonly MusicTrack[], intent: PrefetchIntent): void {
    if (tracks.length === 0) return;
    this.deps.prefetchExternal(tracks, intent);
    if (intent === "press" || intent === "next") for (const track of tracks) void this.deps.sources.get(track, intent === "next" ? "next" : "play");
  }

  /* ── Moteur ── */

  private onEngine(event: EngineEvent): void {
    if (event.type === "state") this.onEngineState(event.state);
    else if (event.type === "advanced") this.onAdvanced(event.toKey);
    else if (event.type === "needSource") refreshEngineSource(this, event.trackKey);
    else if (event.type === "remote") applyRemoteCommand(this, event.command);
    else this.snapshot.update({ origin: event.origin });
  }

  private currentEngineKey(): string | null {
    const item = currentItem(this.snapshot.get().queue);
    return item ? (this.engineKeys.get(item.uid) ?? null) : null;
  }

  private onEngineState(state: EngineState): void {
    const snap = this.snapshot.get();
    if (!snap.current || state.trackKey === null || state.trackKey !== this.currentEngineKey()) return;
    const playing = state.status === "playing";
    // La progression démarre AVEC le son : rien n'avance tant que le moteur n'a pas dit « playing ».
    this.position.set({ positionMs: state.positionMs, durationMs: state.durationMs ?? snap.durationMs, running: playing });
    this.snapshot.update({
      phase: enginePhase(state.status, snap.phase),
      error: state.status === "error" ? "engine" : snap.error,
      format: state.format ?? snap.format,
      durationMs: state.durationMs ?? snap.durationMs,
    });
    if (playing) this.failures.reset();
    if (playing && this.nextAfterStart) {
      this.nextAfterStart = false;
      this.scheduleNext();
    }
    if (playing) {
      this.deps.reporter.started(snap.current, state.positionMs);
      this.deps.reporter.progress(state.positionMs);
    }
    if (state.status === "ended") this.onEnded();
  }

  /** Fin sans enchaînement préparé (source du suivant pas encore là) : on démarre le suivant — enchaîné. */
  private onEnded(): void {
    const moved = advance(this.snapshot.get().queue, true);
    if (moved) this.startItem(moved, 0, "chained");
    else {
      this.deps.reporter.stopped(this.position.get().positionMs, this.position.get().durationMs);
      this.snapshot.update({ wantsPlay: false, phase: "ended" });
      this.position.update({ running: false });
    }
  }

  /** Enchaînement sans blanc fait par le moteur : la file avance d'une entrée, sans relancer le moteur. */
  private onAdvanced(toKey: string | null): void {
    const queue = this.snapshot.get().queue;
    const expected = this.nextUid ? this.engineKeys.get(this.nextUid) : null;
    if (toKey === null || toKey !== expected) return;
    const moved = advance(queue, true);
    const item = moved ? currentItem(moved) : null;
    if (!moved || !item) return;
    this.deps.reporter.stopped(this.position.get().durationMs ?? this.position.get().positionMs, this.position.get().durationMs);
    this.engineKeys.set(item.uid, toKey);
    this.playToken += 1;
    this.snapshot.update({ queue: moved, current: item.track, phase: "playing", durationMs: item.track.durationMs, format: item.track.format, fromDevice: this.nextFromDevice, error: null });
    this.position.set({ positionMs: 0, durationMs: item.track.durationMs, running: true });
    this.nextUid = null;
    this.scheduleNext();
  }
}
