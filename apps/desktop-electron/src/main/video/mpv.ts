/**
 * Instance mpv : cycle de vie, file d'évènements, propriétés observées.
 *
 * Une seule instance à la fois — l'app ne lit qu'une chose. `init` sur une
 * instance vivante la détruit d'abord, ce qui rend l'appel idempotent du point
 * de vue de la page (le lecteur est remonté à chaque épisode).
 */

import koffi from "koffi";
import {
  EVENT,
  EVENT_NAMES,
  FORMAT,
  MpvEvent,
  MpvEventEndFile,
  MpvEventProperty,
  mpv,
  mpvError,
} from "./mpvFfi";

/** Charge utile poussée vers la page. */
export interface PropertyChange {
  name: string;
  data: unknown;
  id: number;
}
export interface MpvEventPayload {
  event: string;
  [key: string]: unknown;
}

type Sink = {
  event: (payload: MpvEventPayload) => void;
  property: (payload: PropertyChange) => void;
};

/**
 * `time-pos` est émis à la cadence des images — 24 fois par seconde sur un
 * film, davantage sur un flux à 60. Le traverser tel quel noierait le pont IPC
 * et ferait rendre React à chaque image pour déplacer une barre de progression
 * de moins d'un pixel. On l'étrangle à 8 Hz, ce qui reste fluide à l'œil.
 */
const TIME_POS_INTERVAL_MS = 125;

let ctx: unknown = null;
let pump: ReturnType<typeof setInterval> | null = null;
let lastTimePos = 0;
let observedIds = new Map<number, string>();

export function isRunning(): boolean {
  return ctx !== null;
}

/** Lit une propriété sous forme de chaîne. `null` si absente. */
export function getProperty(name: string): string | null {
  if (!ctx) return null;
  const ptr = mpv.getPropertyString(ctx, name) as unknown;
  if (!ptr) return null;
  const value = koffi.decode(ptr, "char", -1) as string;
  mpv.free(ptr);
  return value;
}

export function setProperty(name: string, value: string): string | null {
  if (!ctx) return "mpv n'est pas demarre";
  return mpvError(mpv.setPropertyString(ctx, name, value) as number);
}

/** Exécute une commande mpv. Les arguments passent en tableau, jamais
 *  concaténés : un chemin de fichier contient des espaces et des guillemets. */
export function command(args: readonly string[]): string | null {
  if (!ctx) return "mpv n'est pas demarre";
  return mpvError(mpv.command(ctx, [...args, null]) as number);
}

/** Décode la valeur d'une propriété selon son format. */
function decodeProperty(format: number, data: unknown): unknown {
  if (!data || format === FORMAT.NONE) return null;
  if (format === FORMAT.FLAG) return (koffi.decode(data, "int") as number) !== 0;
  if (format === FORMAT.INT64) return Number(koffi.decode(data, "int64") as bigint);
  if (format === FORMAT.DOUBLE) return koffi.decode(data, "double") as number;
  if (format === FORMAT.STRING) {
    const ptr = koffi.decode(data, "void*") as unknown;
    return ptr ? (koffi.decode(ptr, "char", -1) as string) : null;
  }
  return null;
}

/** Vide la file d'évènements et diffuse. */
function drain(sink: Sink): void {
  if (!ctx) return;
  for (;;) {
    const ptr = mpv.waitEvent(ctx, 0) as unknown;
    if (!ptr) return;
    const ev = koffi.decode(ptr, MpvEvent) as {
      event_id: number;
      reply_userdata: bigint;
      data: unknown;
    };
    const id = ev.event_id;
    if (id === EVENT.NONE) return;

    if (id === EVENT.PROPERTY_CHANGE) {
      if (!ev.data) continue;
      const p = koffi.decode(ev.data, MpvEventProperty) as {
        name: string;
        format: number;
        data: unknown;
      };
      // Étranglement : voir TIME_POS_INTERVAL_MS.
      if (p.name === "time-pos") {
        const now = Date.now();
        if (now - lastTimePos < TIME_POS_INTERVAL_MS) continue;
        lastTimePos = now;
      }
      sink.property({
        name: p.name,
        data: decodeProperty(p.format, p.data),
        id: Number(ev.reply_userdata),
      });
      continue;
    }

    if (id === EVENT.END_FILE && ev.data) {
      const end = koffi.decode(ev.data, MpvEventEndFile) as { reason: number; error: number };
      sink.event({ event: "end-file", reason: end.reason, error: end.error });
      continue;
    }

    const nom = EVENT_NAMES[id];
    if (nom) sink.event({ event: nom });
  }
}

export interface InitOptions {
  /** Options passées à mpv AVANT `mpv_initialize`, verbatim. */
  options: Readonly<Record<string, string | number | boolean>>;
  /** Propriétés à observer : `[nom, format]`, format au sens de la page. */
  observed: ReadonlyArray<readonly [string, string]>;
  /** Descripteur de la fenêtre hôte, pour l'embarquement `--wid`. */
  wid: bigint;
}

const FORMAT_BY_NAME: Readonly<Record<string, number>> = {
  flag: FORMAT.FLAG,
  int64: FORMAT.INT64,
  double: FORMAT.DOUBLE,
  string: FORMAT.STRING,
  none: FORMAT.NONE,
};

/** Démarre mpv. Détruit l'instance précédente s'il y en a une. */
export function init(opts: InitOptions, sink: Sink): string | null {
  destroy();

  const handle = mpv.create() as unknown;
  if (!handle) return "mpv_create a echoue";
  ctx = handle;

  for (const [k, v] of Object.entries(opts.options)) {
    // Une option inconnue du libmpv embarqué n'est jamais fatale : mpv la
    // signale et continue. On ne remonte donc pas ces erreurs.
    mpv.setOptionString(ctx, k, typeof v === "boolean" ? (v ? "yes" : "no") : String(v));
  }
  mpv.setOptionString(ctx, "wid", String(opts.wid));

  const err = mpvError(mpv.initialize(ctx) as number);
  if (err) {
    destroy();
    return `mpv_initialize : ${err}`;
  }

  observedIds = new Map();
  opts.observed.forEach(([name, format], index) => {
    const id = index + 1;
    observedIds.set(id, name);
    mpv.observeProperty(ctx, id, name, FORMAT_BY_NAME[format] ?? FORMAT.STRING);
  });

  // 20 ms : assez fin pour que la file ne déborde jamais — libmpv se bloque
  // quand elle est pleine, c'est documenté et ça gèlerait la lecture.
  pump = setInterval(() => drain(sink), 20);
  return null;
}

export function destroy(): void {
  if (pump !== null) clearInterval(pump);
  pump = null;
  if (ctx) mpv.terminateDestroy(ctx);
  ctx = null;
  observedIds = new Map();
  lastTimePos = 0;
}
