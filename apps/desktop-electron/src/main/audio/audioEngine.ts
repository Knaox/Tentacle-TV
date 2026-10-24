/**
 * Le moteur audio NATIF : l'instance mpv de la musique (`audioMpv.ts`), le
 * modèle de sa liste (`audioQueue.ts`) et l'état poussé vers la page.
 *
 * Dans le processus principal : le titre suivant, la bascule à l'instant T, la
 * fin provisoire d'un fichier qui grandit se décident sur les évènements de
 * mpv, sans l'aller-retour de l'IPC. La page (`apps/web/src/music/engine/mpv/`)
 * n'est que l'adaptateur vers `AudioEnginePort`. Aucune méthode n'attend le son.
 */

import type {
  AudioBridgeCapabilities, AudioBridgeControl, AudioBridgeEvent, AudioBridgeOutput, AudioBridgeReplayGainMode,
  AudioBridgeSource, AudioBridgeStart, AudioBridgeTrack,
} from "./audioBridgeContract";
import { codecsFromDecoderList, mpvCapabilities } from "./audioFormat";
import { opArgs, settingCommands } from "./audioEngineOps";
import {
  applyProperty, buildState, durationOf, freshFlags, NO_PROPS, OBSERVED_PROPERTIES, type EngineFlags, type LiveProps, type Settings,
} from "./audioEngineState";
import { AudioMpv, END_REASON } from "./audioMpv";
import { headerFields, outputOptions, startOptions, swapPoint, type Platform } from "./audioOptions";
import { parseOutputs } from "./audioOutputs";
import { AudioQueue, offsetOf, type QueueResult } from "./audioQueue";
import { ProvisionalEnd, StateThrottle } from "./audioEngineTimers";
import { expiresSoon, servedSource } from "./audioSources";
import { cachedToEnd, isRealEnd } from "./partialSource";

export interface EngineConfig {
  platform: Platform;
  /** Avance du point de bascule (s) — au-delà du tampon de la sortie. */
  leadS?: number;
  /** Options en plus (le banc : sortie PCM dans un fichier). */
  extraOptions?: Readonly<Record<string, string>>;
  /** Cadence de la pompe en lecture (ms) — le banc la resserre. */
  activePumpMs?: number;
}


/** L'état part au plus quatre fois par seconde pour la position, tout de suite sinon. */
const STATE_INTERVAL_MS = 250;
const DEFAULT_LEAD_S = 1.5;
/** Une source qui expire dans moins que cela est redemandée d'avance. */
const EXPIRY_MARGIN_MS = 60_000;

export class NativeAudioEngine {
  private readonly mpv: AudioMpv;
  private readonly queue = new AudioQueue();
  private props: LiveProps = { ...NO_PROPS };
  private flags: EngineFlags = freshFlags(false);
  private settings: Settings & { replayGain: AudioBridgeReplayGainMode } = {
    volume: 1, muted: false, deviceId: null, exclusive: false, replayGain: "auto",
  };
  /** Sources basculées pour un titre ni courant ni suivant : servies à son tour. */
  private readonly overrides = new Map<string, AudioBridgeSource>();
  private readonly provisional = new ProvisionalEnd();
  private readonly throttle: StateThrottle;
  /** L'instant T de la bascule en attente, pour dire une bascule manquée. */
  private swapAtS: number | null = null;
  private readonly leadS: number;

  constructor(private readonly config: EngineConfig, private readonly emit: (event: AudioBridgeEvent) => void) {
    this.leadS = config.leadS ?? DEFAULT_LEAD_S;
    this.throttle = new StateThrottle(STATE_INTERVAL_MS, (at) =>
      this.emit({ type: "state", state: buildState(this.queue.current(), this.props, this.flags, this.settings), at }));
    this.mpv = new AudioMpv({
      property: (name, value) => this.onProperty(name, value),
      startFile: (id) => this.onStartFile(id),
      endFile: (id, reason, error) => this.onEndFile(id, reason, error),
      playbackRestart: () => {
        this.flags.awaitingRestart = false;
        this.emitState();
      },
      commandFailed: (_id, args, error) => console.warn(`[audio] ${args[0] ?? "?"} refusée : ${error}`),
    }, config.activePumpMs);
  }

  /** Démarre l'instance (ou met à jour l'authentification) ; rend les capacités. */
  async start(start: AudioBridgeStart): Promise<AudioBridgeCapabilities> {
    Object.assign(this.settings, {
      volume: start.volume, muted: start.muted, deviceId: start.deviceId, exclusive: start.exclusive, replayGain: start.replayGain,
    });
    const headers = headerFields(start.headers);
    if (this.mpv.isRunning()) {
      await this.mpv.set("http-header-fields", headers);
    } else {
      const options = startOptions(this.config.platform, start, headers, this.config.extraOptions ?? {});
      const failed = this.mpv.start(options, OBSERVED_PROPERTIES);
      if (failed !== null) throw new Error(failed);
    }
    return mpvCapabilities(codecsFromDecoderList(await this.mpv.get("decoder-list")));
  }

  play(track: AudioBridgeTrack, source: AudioBridgeSource, startMs: number): void {
    this.provisional.reset();
    this.flags = freshFlags(true);
    this.props = { ...NO_PROPS };
    this.run(this.queue.play(track, servedSource(this.overrides, track.trackKey, source), startMs > 0 ? startMs / 1000 : null));
    this.checkExpiry(track.trackKey, source);
    this.mpv.setActive(true);
  }

  setNext(track: AudioBridgeTrack | null, source: AudioBridgeSource | null): void {
    const served = track !== null && source !== null ? servedSource(this.overrides, track.trackKey, source) : null;
    this.run(this.queue.setNext(track, served));
    if (track !== null && served !== null) this.checkExpiry(track.trackKey, served);
  }

  swap(trackKey: string, source: AudioBridgeSource): void {
    const positionS = this.positionS();
    const durationMs = durationOf(this.queue.current(), this.props);
    const room = durationMs === null || durationMs / 1000 - positionS > this.leadS + 0.5;
    const at = room ? swapPoint(positionS, this.props.sampleRate, this.leadS) : null;
    const result = this.queue.swap(trackKey, source, {
      positionS,
      started: this.queue.isStarted() && !this.flags.awaitingRestart,
      atEnd: this.props.eofReached || this.flags.reloading,
      swapAtS: at,
    });
    if (result === null) {
      this.overrides.set(trackKey, source);
      return;
    }
    if (result.ops.some((op) => op.op === "setEnd")) this.swapAtS = at;
    if (this.flags.reloading || this.props.eofReached) this.clearReload();
    this.run(result);
  }

  control(c: AudioBridgeControl): void {
    switch (c.action) {
      case "pause":
        this.flags.wantPaused = true;
        void this.mpv.set("pause", "yes");
        break;
      case "resume":
        this.flags.wantPaused = false;
        if (this.flags.ended) this.seekTo(0);
        void this.mpv.set("pause", "no");
        this.mpv.setActive(true);
        break;
      case "stop":
        this.clearReload();
        this.run(this.queue.stop());
        this.flags = freshFlags(false);
        this.props = { ...NO_PROPS };
        this.mpv.setActive(false);
        break;
      case "seek":
        this.seekTo(c.value / 1000);
        break;
      default:
        // Volume, sourdine, ReplayGain : des réglages, sans effet sur la file.
        for (const args of settingCommands(c, this.settings, this.queue.current())) void this.mpv.command(args);
    }
    this.emitState();
  }

  async listOutputs(): Promise<AudioBridgeOutput[]> {
    return parseOutputs(this.config.platform, await this.mpv.get("audio-device-list"));
  }

  async setOutput(deviceId: string | null, exclusive: boolean): Promise<void> {
    Object.assign(this.settings, { deviceId, exclusive });
    const sets = Object.entries(outputOptions(this.config.platform, deviceId, exclusive)).map(([k, v]) => this.mpv.set(k, v));
    const errors = (await Promise.all(sets)).filter((e) => e !== null);
    this.emitState();
    if (errors.length > 0) throw new Error(errors.join(" ; "));
  }

  /** Une propriété de mpv, en chaîne — banc et diagnostic seulement. */
  readProperty = (name: string): Promise<string | null> => this.mpv.get(name);

  /** Arrête l'instance et libère la sortie (le mode exclusif avec). */
  dispose(): Promise<void> {
    this.clearReload();
    this.throttle.cancel();
    return this.mpv.destroy();
  }

  private checkExpiry = (trackKey: string, source: AudioBridgeSource): void =>
    void (expiresSoon(source, Date.now(), EXPIRY_MARGIN_MS) && this.emit({ type: "needSource", trackKey }));

  private seekTo(seconds: number): void {
    this.clearReload();
    this.flags.ended = false;
    this.run(this.queue.seek(Math.max(0, seconds)));
  }

  private run(result: QueueResult): void {
    for (const op of result.ops) {
      const args = opArgs(op, this.settings.replayGain);
      if (op.op === "load" && op.mode === "replace") {
        // `keep-open` met mpv en pause sur la fin d'un fichier ; un chargement
        // en hérite (titre retenu, relecture) — sauf pause VOULUE.
        if (!this.flags.wantPaused) void this.mpv.set("pause", "no");
        this.flags.awaitingRestart = true;
        this.props = { ...this.props, timePos: null, eofReached: false };
      }
      const entry = op.op === "load" ? op.entry : null;
      void this.mpv.command(args).then((error) => {
        if (error === null || entry === null) return;
        this.queue.loadFailed(entry.mpvId);
        if (this.queue.current() === null || op.op === "load" && op.mode === "replace") this.fail(`load: ${error}`, entry.track.trackKey, entry.source);
      });
    }
    for (const notice of result.notices) this.emit(notice);
    this.emitState();
  }

  private fail(message: string, trackKey: string, source: AudioBridgeSource): void {
    this.flags.error = message;
    this.mpv.setActive(false);
    const expired = source.expiresAt !== null && source.expiresAt <= Date.now();
    if (source.origin === "plugin" || expired) this.emit({ type: "needSource", trackKey });
    this.emitState();
  }

  private onProperty(name: string, value: unknown): void {
    this.props = applyProperty(this.props, name, value);
    if (name === "eof-reached" && value === true) this.onEof();
    if (name !== "demuxer-cache-time") return this.emitState(name === "time-pos" || name === "audio-bitrate");
    const current = this.queue.current();
    if (current !== null && !current.source.complete && cachedToEnd(this.props.cacheTime, offsetOf(current), durationOf(current, this.props))) {
      this.run(this.queue.markCurrentComplete());
    }
  }

  /** La position dans le TITRE (s) — une entrée EDL de bascule part de son instant T. */
  private positionS(): number {
    return (this.props.timePos ?? 0) + offsetOf(this.queue.current());
  }

  private onStartFile(mpvId: number): void {
    const before = this.props.timePos === null ? null : this.positionS();
    const result = this.queue.startFile(mpvId);
    if (result === null) {
      console.warn(`[audio] entrée mpv inconnue : ${mpvId}`);
      return;
    }
    const swapped = result.notices.some((n) => n.type === "swapped");
    if (swapped && this.swapAtS !== null && before !== null && before > this.swapAtS + 0.05) {
      console.warn(`[audio] bascule manquée : T=${this.swapAtS.toFixed(3)} s, déjà à ${before.toFixed(3)} s`);
    }
    if (swapped) this.swapAtS = null;
    // Nouveau fichier : fin pas atteinte (mpv fond deux changements proches),
    // et la pause posée par `keep-open` sur la fin du précédent levée.
    this.props = { ...this.props, eofReached: false, timePos: null };
    if (!this.flags.wantPaused) void this.mpv.set("pause", "no");
    if (!this.flags.reloading) this.provisional.reset();
    this.flags.reloading = false;
    this.flags.ended = false;
    this.flags.error = null;
    this.run(result);
  }

  private onEndFile(mpvId: number, reason: number, error: number): void {
    const current = this.queue.current();
    if (reason !== END_REASON.ERROR || current === null || current.mpvId !== mpvId) return;
    this.fail(`end-file ${error}`, current.track.trackKey, current.source);
  }

  /** mpv tient la fin du dernier fichier (`keep-open`) : vraie fin, ou provisoire ? */
  private onEof(): void {
    const current = this.queue.current();
    if (current === null || !this.queue.isStarted() || this.flags.awaitingRestart || this.provisional.pending()) return;
    const real = isRealEnd({
      complete: current.source.complete,
      durationMs: durationOf(current, this.props),
      positionMs: this.positionS() * 1000,
      stalledReloads: this.provisional.stalledReloads(),
    });
    if (!real) {
      this.flags.reloading = true;
      this.provisional.schedule(
        () => this.queue.current() === current && this.props.eofReached,
        () => this.positionS() * 1000,
        (positionS) => this.run(this.queue.reload(positionS)),
      );
      this.emitState();
      return;
    }
    const next = this.queue.advanceHeld();
    if (next !== null) {
      this.run(next);
      return;
    }
    this.flags.ended = true;
    this.mpv.setActive(false);
    this.emitState();
  }

  private clearReload(): void {
    this.provisional.cancel();
    this.flags.reloading = false;
  }

  /** Pousse l'état ; `throttled` (la position) : au plus quatre fois par seconde. */
  private emitState(throttled = false): void {
    this.throttle.push(throttled);
  }
}
