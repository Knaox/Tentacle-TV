/**
 * Octave — la qualité RÉELLE d'un titre, en mots courts, pour la barre de
 * lecture et les listes. Rien de déduit : on dit ce que le format déclare
 * (contrat `MusicAudioFormat`), le moteur ou la bibliothèque l'ayant lu.
 */

import type { MusicAudioFormat } from "../music";

/** Les noms d'affichage des codecs ; au-delà, le nom en capitales. */
const CODEC_LABEL: Record<string, string> = {
  flac: "FLAC",
  alac: "ALAC",
  opus: "Opus",
  aac: "AAC",
  mp3: "MP3",
  wav: "WAV",
  pcm: "PCM",
  dsd: "DSD",
  vorbis: "Vorbis",
  aiff: "AIFF",
};

export function codecLabel(codec: string): string {
  return CODEC_LABEL[codec.toLowerCase()] ?? codec.toUpperCase();
}

/** « 96 kHz », « 44,1 kHz » (séparateur décimal de la langue). */
export function sampleRateLabel(hz: number, locale: string): string {
  const khz = hz / 1000;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(khz)} kHz`;
}

export interface FormatParts {
  /** « FLAC » */
  codec: string;
  /** « 24 bits · 96 kHz » ou « 320 kb/s » — `null` si rien de sûr. */
  detail: string | null;
  lossless: boolean;
  /** Haute résolution : au-delà du CD (plus de 16 bits ou de 48 kHz), sans perte. */
  hiRes: boolean;
}

export interface FormatWords {
  bits: (n: number) => string;
  kbps: (n: number) => string;
}

export function formatParts(format: MusicAudioFormat, locale: string, words: FormatWords): FormatParts {
  const codec = codecLabel(format.codec);
  const pieces: string[] = [];
  if (format.lossless) {
    if (format.bitDepth) pieces.push(words.bits(format.bitDepth));
    if (format.sampleRate) pieces.push(sampleRateLabel(format.sampleRate, locale));
  } else if (format.bitrate) {
    pieces.push(words.kbps(Math.round(format.bitrate / 1000)));
  } else if (format.sampleRate) {
    pieces.push(sampleRateLabel(format.sampleRate, locale));
  }
  const hiRes = format.lossless && ((format.bitDepth ?? 0) > 16 || (format.sampleRate ?? 0) > 48_000);
  return { codec, detail: pieces.length ? pieces.join(" · ") : null, lossless: format.lossless, hiRes };
}

/** « 3:07 », « 1:02:09 » — chiffres tabulaires côté vue. */
export function durationLabel(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms) || ms < 0) return "–:––";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = s.toString().padStart(2, "0");
  return h > 0 ? `${h}:${m.toString().padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** La durée d'une liste, arrondie à la minute (« 47 min », « 1 h 12 min »). */
export function totalDurationParts(ms: number): { hours: number; minutes: number } {
  const minutes = Math.round(ms / 60_000);
  return { hours: Math.floor(minutes / 60), minutes: minutes % 60 };
}
