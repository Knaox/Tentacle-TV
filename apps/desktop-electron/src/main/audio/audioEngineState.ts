/**
 * L'état du moteur tel que la page le reçoit (`AudioBridgeState`), dérivé de
 * ce que mpv dit (propriétés observées) et de ce que le moteur sait (pause
 * voulue, relecture d'une fin provisoire, fin, erreur). Pur.
 */

import type { AudioBridgeState, AudioBridgeStatus } from "./audioBridgeContract";
import { decodedFormat } from "./audioFormat";
import { offsetOf, type QueueEntry } from "./audioQueue";
import type { ObservedFormat } from "./audioMpv";

/** Les propriétés observées, au dernier évènement reçu. */
export interface LiveProps {
  timePos: number | null;
  eofReached: boolean;
  pausedForCache: boolean;
  codecName: string | null;
  fileFormat: string | null;
  sampleRate: number | null;
  channels: number | null;
  bitrate: number | null;
  mpvDuration: number | null;
  /** Dernier instant en cache du démultiplexeur (chronologie de l'entrée). */
  cacheTime: number | null;
}

export const NO_PROPS: LiveProps = {
  timePos: null,
  eofReached: false,
  pausedForCache: false,
  codecName: null,
  fileFormat: null,
  sampleRate: null,
  channels: null,
  bitrate: null,
  mpvDuration: null,
  cacheTime: null,
};

export interface EngineFlags {
  wantPaused: boolean;
  /** Un fichier vient d'être (re)chargé : pas encore de son (`playback-restart`). */
  awaitingRestart: boolean;
  /** Fin provisoire : une relecture est prévue. */
  reloading: boolean;
  ended: boolean;
  error: string | null;
}

export interface Settings {
  volume: number;
  muted: boolean;
  deviceId: string | null;
  exclusive: boolean;
}

export function deriveStatus(current: QueueEntry | null, props: LiveProps, flags: EngineFlags): AudioBridgeStatus {
  if (flags.error !== null) return "error";
  if (current === null) return "idle";
  if (flags.ended) return "ended";
  // Seul un CHARGEMENT dit « loading » : au passage d'un titre au suivant sans
  // blanc, `time-pos` disparaît un instant sans que rien ne s'arrête.
  if (flags.awaitingRestart) return "loading";
  if (flags.reloading || props.pausedForCache) return "buffering";
  return flags.wantPaused ? "paused" : "playing";
}

/**
 * La durée : celle que mpv MESURE quand le fichier est complet (hors EDL), sinon celle de la source, du titre.
 * La mesure l'emporte (lot « fl », 30/10) : la durée annoncée (métadonnées) d'une source tierce diffère souvent du
 * fichier lu de quelques secondes — la barre finissait avant le son, et un clic tombait à côté. Comme le fondu
 * (`deckTimeline`) et le mobile (`frontDeck.durationMs ?? annoncée`).
 */
export function durationOf(current: QueueEntry | null, props: LiveProps): number | null {
  if (current === null) return null;
  // La durée d'une entrée EDL (bascule) est celle du segment, pas du titre.
  const own = current.source.complete && offsetOf(current) === 0 ? props.mpvDuration : null;
  if (own !== null && own > 0) return Math.round(own * 1000);
  return current.source.durationMs ?? current.track.durationMs;
}

export function buildState(current: QueueEntry | null, props: LiveProps, flags: EngineFlags, settings: Settings): AudioBridgeState {
  const status = deriveStatus(current, props, flags);
  const startMs = current?.startS !== null && current?.startS !== undefined ? current.startS * 1000 : 0;
  const positionMs = status === "loading" || props.timePos === null ? startMs : (props.timePos + offsetOf(current)) * 1000;
  return {
    status,
    trackKey: current?.track.trackKey ?? null,
    positionMs: Math.max(0, Math.round(positionMs)),
    durationMs: durationOf(current, props),
    volume: settings.volume,
    muted: settings.muted,
    format: current === null ? null : decodedFormat(props, current.track.format),
    output: { deviceId: settings.deviceId, exclusive: settings.exclusive },
    error: flags.error,
  };
}

/** Les propriétés que le moteur observe sur son instance. */
export const OBSERVED_PROPERTIES: ReadonlyArray<readonly [string, ObservedFormat]> = [
  ["time-pos", "double"],
  ["eof-reached", "flag"],
  ["paused-for-cache", "flag"],
  ["audio-codec-name", "string"],
  ["file-format", "string"],
  ["audio-params/samplerate", "int64"],
  ["audio-params/channel-count", "int64"],
  ["audio-bitrate", "double"],
  ["duration", "double"],
  ["demuxer-cache-time", "double"],
];

/** Une propriété reçue → les propriétés à jour (pur). */
export function applyProperty(props: LiveProps, name: string, value: unknown): LiveProps {
  const num = typeof value === "number" && Number.isFinite(value) ? value : null;
  const str = typeof value === "string" ? value : null;
  switch (name) {
    case "time-pos": return { ...props, timePos: num };
    case "eof-reached": return { ...props, eofReached: value === true };
    case "paused-for-cache": return { ...props, pausedForCache: value === true };
    case "audio-codec-name": return { ...props, codecName: str };
    case "file-format": return { ...props, fileFormat: str };
    case "audio-params/samplerate": return { ...props, sampleRate: num };
    case "audio-params/channel-count": return { ...props, channels: num };
    case "audio-bitrate": return { ...props, bitrate: num };
    case "duration": return { ...props, mpvDuration: num };
    case "demuxer-cache-time": return { ...props, cacheTime: num };
    default: return props;
  }
}

/** Les drapeaux d'un moteur au repos, ou d'un titre qui vient d'être lancé. */
export function freshFlags(awaitingRestart: boolean): EngineFlags {
  return { wantPaused: false, awaitingRestart, reloading: false, ended: false, error: null };
}
