import type { JellyfinCaller } from "./jellyfinCalls";
import type { PlaybackEventDto, PlaybackStateDto } from "./protocolMessages";

/**
 * Quand une lecture mérite une requête à Jellyfin — et quand elle n'en mérite
 * pas. Une instance par lecture en cours d'une connexion.
 *
 * Le lecteur envoie son état au backend à chaque bord et toutes les dix
 * secondes : ça ne coûte rien, c'est un message sur un socket déjà ouvert.
 * Jellyfin, lui, ne reçoit que ce qui change quelque chose :
 *
 *  - le début, la fin, et chaque BORD — pause, reprise, saut, pistes, volume —
 *    regroupés quand ils se suivent de près (un glissement de la barre de
 *    progression vaut dix sauts) ;
 *  - un signe de vie toutes les quatre minutes. Il n'est pas négociable :
 *    toutes les cinq minutes, Jellyfin clôt d'office une lecture sans report
 *    depuis plus de cinq minutes (`CheckForIdlePlayback`, 10.11) ;
 *  - en pause sur un flux transcodé, le ping du transcodage toutes les 40 s.
 *    Sans lui, ffmpeg est tué au bout de 60 s sans requête de segment, et la
 *    reprise attend qu'il redémarre. Un ping ne compte pas comme report : le
 *    signe de vie reste dû.
 *
 * Tous les envois passent par une même file : un report qui traîne ne peut
 * pas arriver APRÈS l'arrêt et ranimer la lecture chez Jellyfin.
 */

const TICKS_PER_MS = 10_000;

/** Sous le seuil d'inactivité de Jellyfin (plus de 5 min, contrôlé toutes les 5 min). */
export const HEARTBEAT_MS = 240_000;
/** Le minuteur d'abandon d'un transcodage HLS est de 60 s (`TranscodeManager`). */
export const TRANSCODE_PING_MS = 40_000;
/** Deux bords plus rapprochés que ça partent en un seul report. */
export const EDGE_COALESCE_MS = 400;
/**
 * Au-delà, on n'extrapole plus la position depuis le dernier message. Un
 * onglet caché n'a plus qu'un minuteur par minute ; au-delà d'une minute et
 * demie de silence, le lecteur n'est plus là pour avancer.
 */
export const MAX_EXTRAPOLATION_MS = 90_000;

type Timer = ReturnType<typeof setTimeout>;

function samePlayback(a: PlaybackStateDto, b: PlaybackStateDto): boolean {
  return a.itemId === b.itemId && (a.playSessionId ?? "") === (b.playSessionId ?? "");
}

export class PlaybackReporter {
  private state: PlaybackStateDto | null = null;
  private receivedAt = 0;
  private heartbeatTimer: Timer | null = null;
  private edgeTimer: Timer | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly jf: JellyfinCaller,
    private readonly now: () => number = Date.now,
  ) {}

  isActive(): boolean {
    return this.state !== null;
  }

  /** L'état courant, position extrapolée — pour le tableau de bord et l'arrêt. */
  current(): PlaybackStateDto | null {
    if (this.state === null) return null;
    if (this.state.isPaused) return { ...this.state };
    const elapsed = Math.min(Math.max(this.now() - this.receivedAt, 0), MAX_EXTRAPOLATION_MS);
    return { ...this.state, positionTicks: Math.floor(this.state.positionTicks + elapsed * TICKS_PER_MS) };
  }

  /**
   * Début de lecture. `resumed` : elle tournait déjà (reconnexion, canal ouvert
   * en cours de route) — Jellyfin la connaît, un simple report la rattache sans
   * déclencher un nouveau « début » chez ses greffons. La MÊME lecture déjà
   * suivie ici est adoptée sans rien envoyer.
   */
  async start(state: PlaybackStateDto, resumed = false): Promise<void> {
    if (this.state !== null && !samePlayback(this.state, state)) await this.stop();
    const adopted = this.state !== null;
    this.accept(state);
    if (adopted) return;
    await this.report(resumed ? "/Sessions/Playing/Progress" : "/Sessions/Playing");
  }

  progress(event: PlaybackEventDto, state: PlaybackStateDto): void {
    if (this.state === null || !samePlayback(this.state, state)) {
      // Un report sans début connu : la lecture tourne chez le client.
      void this.start(state, true);
      return;
    }
    this.accept(state);
    if (event === "tick") return;
    if (this.edgeTimer !== null) return;
    this.edgeTimer = setTimeout(() => {
      this.edgeTimer = null;
      void this.report("/Sessions/Playing/Progress");
    }, EDGE_COALESCE_MS);
  }

  /** Fin de lecture, à la position finale si le lecteur l'a donnée. Vrai si Jellyfin l'a reçue. */
  stop(final?: PlaybackStateDto): Promise<boolean> {
    if (this.state === null) return Promise.resolve(true);
    if (final !== undefined && samePlayback(this.state, final)) this.accept(final);
    const last = this.current();
    this.clearTimers();
    this.state = null;
    if (last === null) return Promise.resolve(true);
    const body = {
      ItemId: last.itemId,
      MediaSourceId: last.mediaSourceId ?? last.itemId,
      PlaySessionId: last.playSessionId,
      PositionTicks: last.positionTicks,
    };
    return this.enqueue(() => this.jf.post("/Sessions/Playing/Stopped", body));
  }

  /** La connexion Jellyfin de l'appareil vient de (re)naître : il a pu tout oublier. */
  resync(): void {
    if (this.state !== null) void this.report("/Sessions/Playing/Progress");
  }

  /** Oublie tout sans rien dire à Jellyfin (le processus s'arrête). */
  dispose(): void {
    this.clearTimers();
    this.state = null;
  }

  private accept(state: PlaybackStateDto): void {
    this.state = state;
    this.receivedAt = this.now();
    const needsPing = state.isPaused && state.playMethod !== "DirectPlay" && state.playSessionId !== undefined;
    if (needsPing && this.pingTimer === null) {
      this.pingTimer = setInterval(() => {
        const id = this.state?.playSessionId;
        if (id === undefined) return;
        void this.enqueue(() => this.jf.post(`/Sessions/Playing/Ping?playSessionId=${encodeURIComponent(id)}`, undefined));
      }, TRANSCODE_PING_MS);
    } else if (!needsPing && this.pingTimer !== null) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  /** Report de l'état courant ; réarme le signe de vie. */
  private report(path: string): Promise<boolean> {
    const s = this.current();
    if (s === null) return Promise.resolve(false);
    if (this.heartbeatTimer !== null) clearTimeout(this.heartbeatTimer);
    this.heartbeatTimer = setTimeout(() => {
      this.heartbeatTimer = null;
      void this.report("/Sessions/Playing/Progress");
    }, HEARTBEAT_MS);
    const body = {
      ItemId: s.itemId,
      MediaSourceId: s.mediaSourceId ?? s.itemId,
      PlaySessionId: s.playSessionId,
      PositionTicks: s.positionTicks,
      IsPaused: s.isPaused,
      PlayMethod: s.playMethod,
      CanSeek: s.canSeek ?? true,
      AudioStreamIndex: s.audioStreamIndex,
      SubtitleStreamIndex: s.subtitleStreamIndex ?? -1,
      VolumeLevel: s.volumeLevel,
      IsMuted: s.isMuted,
    };
    return this.enqueue(() => this.jf.post(path, body));
  }

  private enqueue(send: () => Promise<boolean>): Promise<boolean> {
    const next = this.queue.then(send, send);
    this.queue = next.catch(() => undefined);
    return next;
  }

  private clearTimers(): void {
    if (this.heartbeatTimer !== null) clearTimeout(this.heartbeatTimer);
    if (this.edgeTimer !== null) clearTimeout(this.edgeTimer);
    if (this.pingTimer !== null) clearInterval(this.pingTimer);
    this.heartbeatTimer = null;
    this.edgeTimer = null;
    this.pingTimer = null;
  }
}
