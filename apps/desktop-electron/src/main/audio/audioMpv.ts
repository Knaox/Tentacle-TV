/**
 * L'instance mpv de la MUSIQUE : un cœur à part, sur la même libmpv que la
 * vidéo (`mpvApi()`, chargée une fois), sans fenêtre ni sortie vidéo.
 *
 * Pourquoi pas `video/mpv.ts` : c'est un singleton par module (poignée,
 * commandes en vol, souvenir des propriétés), pensé pour UNE lecture. Une
 * seconde instance y aurait mêlé ses réponses à celles du film — et l'arrêt de
 * l'un réglait les commandes de l'autre (`settleAllCommands`). Ici tout l'état
 * vit dans l'objet.
 *
 * # Rien de bloquant sur le fil principal
 *
 * Mêmes règles que la vidéo, même si une instance sans sortie vidéo ne touche
 * jamais à la `NSWindow` : commandes et écritures par `mpv_command_async`,
 * lectures par `mpv_get_property_async`, file d'évènements vidée sans attendre
 * (`mpv_wait_event(0)`).
 *
 * # L'arrêt : `quit`, puis libérer à l'évènement d'arrêt
 *
 * Mesuré sur ce Mac (instance audio, sortie CoreAudio ouverte) :
 * `mpv_terminate_destroy` d'un bloc a tenu le fil principal 47 ms… et une fois
 * 1 555 ms. `quit` (asynchrone) puis `mpv_destroy` à `MPV_EVENT_SHUTDOWN` :
 * 7 ms + 51 à 57 ms, régulier. L'appel « async » de koffi (un fil de
 * travail) a fait tomber le processus (SIGSEGV) : jamais.
 */

import koffi from "koffi";
import { setNumericLocaleC } from "../video/cLocale";
import { EVENT, FORMAT, MpvEvent, MpvEventProperty, mpvApi, mpvError } from "../video/mpvFfi";
import { NO_SCRIPTS } from "../video/mpvNoScripts";

// `mpv_event_start_file` : { int64 playlist_entry_id; }
const StartFile = koffi.struct("audio_mpv_event_start_file", { playlist_entry_id: "int64" });
// `mpv_event_end_file` : { int reason; int error; int64 playlist_entry_id; … }
const EndFile = koffi.struct("audio_mpv_event_end_file", {
  reason: "int",
  error: "int",
  playlist_entry_id: "int64",
});

/** Raisons de `MPV_EVENT_END_FILE` (`client.h`). */
export const END_REASON = { EOF: 0, STOP: 2, QUIT: 3, ERROR: 4, REDIRECT: 5 } as const;

export type ObservedFormat = "flag" | "int64" | "double" | "string";

export interface AudioMpvListener {
  property: (name: string, value: unknown) => void;
  startFile: (entryId: number) => void;
  endFile: (entryId: number, reason: number, error: number) => void;
  playbackRestart: () => void;
  /** Une commande a échoué dans le cœur (après l'envoi). */
  commandFailed: (id: number, args: readonly string[], error: string) => void;
}

const FORMAT_CODE: Readonly<Record<ObservedFormat, number>> = {
  flag: FORMAT.FLAG,
  int64: FORMAT.INT64,
  double: FORMAT.DOUBLE,
  string: FORMAT.STRING,
};

/** 20 ms en lecture (la file ne déborde jamais), 250 ms à l'arrêt. */
const ACTIVE_PUMP_MS = 20;
const IDLE_PUMP_MS = 250;
const MAX_PER_PASS = 128;
/** Identifiants de réponse : base distincte des propriétés observées. */
const REPLY_BASE = 1_000_000;

function decodeValue(format: number, data: unknown): unknown {
  if (!data) return null;
  if (format === FORMAT.FLAG) return (koffi.decode(data, "int") as number) !== 0;
  if (format === FORMAT.INT64) return Number(koffi.decode(data, "int64"));
  if (format === FORMAT.DOUBLE) return koffi.decode(data, "double") as number;
  if (format === FORMAT.STRING) {
    const ptr = koffi.decode(data, "void*") as unknown;
    return ptr ? (koffi.decode(ptr, "char", -1) as string) : null;
  }
  return null;
}

export class AudioMpv {
  private ctx: unknown = null;
  private pump: ReturnType<typeof setInterval> | null = null;
  private pumpMs = IDLE_PUMP_MS;
  private nextReply = REPLY_BASE;
  private readonly observedNames = new Map<number, string>();
  private readonly commands = new Map<number, { args: readonly string[]; resolve: (e: string | null) => void }>();
  private readonly reads = new Map<number, (value: unknown) => void>();
  private stopping: { done: () => void; fallback: ReturnType<typeof setTimeout> } | null = null;
  private stopped: Promise<void> | null = null;

  /** `activePumpMs` : la cadence en lecture (le banc la resserre pour dater le son). */
  constructor(private readonly listener: AudioMpvListener, private readonly activePumpMs = ACTIVE_PUMP_MS) {}

  isRunning(): boolean {
    return this.ctx !== null;
  }

  /** Crée et initialise le cœur. Rend le motif de l'échec, ou `null`. */
  start(options: Readonly<Record<string, string>>, observed: ReadonlyArray<readonly [string, ObservedFormat]>): string | null {
    if (this.ctx !== null) return null;
    setNumericLocaleC();
    const api = mpvApi();
    const handle = api.create() as unknown;
    if (!handle) return "mpv_create a echoue";
    for (const [k, v] of Object.entries({ ...options, ...NO_SCRIPTS })) {
      const code = api.setOptionString(handle, k, v) as number;
      if (code < 0) console.warn(`[audio] option refusée (${code}) : ${k}=${v}`);
    }
    const err = mpvError(api.initialize(handle) as number);
    if (err !== null) {
      api.terminateDestroy(handle);
      return `mpv_initialize : ${err}`;
    }
    this.ctx = handle;
    observed.forEach(([name, format], index) => {
      this.observedNames.set(index + 1, name);
      api.observeProperty(handle, index + 1, name, FORMAT_CODE[format]);
    });
    this.setActive(false);
    return null;
  }

  /** La cadence de la pompe : celle de la lecture, ou celle du repos. */
  setActive(active: boolean): void {
    const ms = active ? this.activePumpMs : IDLE_PUMP_MS;
    if (this.pump !== null && ms === this.pumpMs) return;
    if (this.pump !== null) clearInterval(this.pump);
    this.pumpMs = ms;
    this.pump = setInterval(() => this.drain(), ms);
  }

  /** Une commande, sans attendre le cœur ; la promesse se règle à sa réponse. */
  command(args: readonly string[]): Promise<string | null> {
    if (this.ctx === null) return Promise.resolve("mpv audio arrete");
    const id = this.nextReply++;
    return new Promise((resolve) => {
      this.commands.set(id, { args, resolve });
      const sent = mpvError(mpvApi().commandAsync(this.ctx, id, [...args, null]) as number);
      if (sent !== null) {
        this.commands.delete(id);
        resolve(sent);
      }
    });
  }

  set(name: string, value: string): Promise<string | null> {
    return this.command(["set", name, value]);
  }

  /** Lit une propriété en chaîne (JSON pour un nœud), sans attendre le cœur. */
  get(name: string): Promise<string | null> {
    if (this.ctx === null) return Promise.resolve(null);
    const id = this.nextReply++;
    return new Promise((resolve) => {
      this.reads.set(id, (v) => resolve(typeof v === "string" ? v : null));
      const code = mpvApi().getPropertyAsync(this.ctx, id, name, FORMAT.STRING) as number;
      if (code < 0) {
        this.reads.delete(id);
        resolve(null);
      }
    });
  }

  /** Vide la file d'évènements (aussi appelée par le banc, à son rythme). */
  drain(): void {
    if (this.ctx === null) return;
    const api = mpvApi();
    for (let n = 0; n < MAX_PER_PASS; n += 1) {
      const ptr = api.waitEvent(this.ctx, 0) as unknown;
      if (!ptr) return;
      const ev = koffi.decode(ptr, MpvEvent) as { event_id: number; error: number; reply_userdata: bigint | number; data: unknown };
      if (ev.event_id === EVENT.NONE) return;
      if (ev.event_id === EVENT.SHUTDOWN) return this.release(false);
      this.dispatch(ev.event_id, ev.error, Number(ev.reply_userdata), ev.data);
    }
  }

  private dispatch(id: number, error: number, reply: number, data: unknown): void {
    if (id === EVENT.COMMAND_REPLY) {
      const pending = this.commands.get(reply);
      if (pending === undefined) return;
      this.commands.delete(reply);
      const failed = mpvError(error);
      if (failed !== null) this.listener.commandFailed(reply, pending.args, failed);
      pending.resolve(failed);
      return;
    }
    if (id === EVENT.GET_PROPERTY_REPLY) {
      const read = this.reads.get(reply);
      if (read === undefined) return;
      this.reads.delete(reply);
      const p = error >= 0 && data ? (koffi.decode(data, MpvEventProperty) as { format: number; data: unknown }) : null;
      read(p === null ? null : decodeValue(p.format, p.data));
      return;
    }
    if (id === EVENT.PROPERTY_CHANGE && data) {
      const p = koffi.decode(data, MpvEventProperty) as { name: string; format: number; data: unknown };
      this.listener.property(p.name, decodeValue(p.format, p.data));
      return;
    }
    if (id === EVENT.START_FILE && data) {
      const s = koffi.decode(data, StartFile) as { playlist_entry_id: number | bigint };
      this.listener.startFile(Number(s.playlist_entry_id));
      return;
    }
    if (id === EVENT.END_FILE && data) {
      const e = koffi.decode(data, EndFile) as { reason: number; error: number; playlist_entry_id: number | bigint };
      this.listener.endFile(Number(e.playlist_entry_id), e.reason, e.error);
      return;
    }
    if (id === EVENT.PLAYBACK_RESTART) this.listener.playbackRestart();
  }

  /** Arrête le cœur (`quit`), puis le libère à son évènement d'arrêt — 3 s au plus. */
  destroy(): Promise<void> {
    if (this.stopped !== null) return this.stopped;
    if (this.ctx === null) return Promise.resolve();
    for (const { resolve } of this.commands.values()) resolve("mpv audio arrete");
    this.commands.clear();
    for (const read of this.reads.values()) read(null);
    this.reads.clear();
    this.stopped = new Promise((done) => {
      this.stopping = { done, fallback: setTimeout(() => this.release(true), 3000) };
      mpvApi().commandAsync(this.ctx, 0, ["quit", null]);
      this.setActive(true);
    });
    return this.stopped;
  }

  private release(forced: boolean): void {
    if (this.pump !== null) clearInterval(this.pump);
    this.pump = null;
    const handle = this.ctx;
    this.ctx = null;
    if (handle) {
      if (forced) mpvApi().terminateDestroy(handle);
      else mpvApi().destroyClient(handle);
    }
    const stopping = this.stopping;
    this.stopping = null;
    this.stopped = null;
    if (stopping !== null) {
      clearTimeout(stopping.fallback);
      stopping.done();
    }
  }
}
