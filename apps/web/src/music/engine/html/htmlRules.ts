/**
 * Les règles du moteur `<audio>` : pures, sans DOM (`htmlRules.test.ts`).
 *
 * Ce moteur ne PROMET pas le gapless (`capabilities.gapless: false`) : deux
 * éléments `<audio>` ne s'enchaînent pas à l'échantillon. Il fait de son mieux
 * — le suivant préchargé démarre un peu AVANT la fin du courant, de la latence
 * de démarrage mesurée, pour qu'un chevauchement de quelques millisecondes
 * remplace le blanc — et le banc dit combien il reste.
 */

import type { PlaybackSource, ReplayGainMode } from "@tentacle-tv/shared/music";

/** Au-delà, le gain d'un titre ne monte pas (un `<audio>` n'amplifie pas au-dessus de 1). */
const MAX_GAIN_DB = 0;

export type EffectiveGainMode = "off" | "track" | "album";

/** « auto » : l'album quand un voisin est du même album, le titre sinon. */
export function effectiveGainMode(mode: ReplayGainMode, albumKey: string | null, neighbours: ReadonlyArray<string | null>): EffectiveGainMode {
  if (mode !== "auto") return mode;
  if (albumKey === null) return "track";
  return neighbours.some((k) => k !== null && k === albumKey) ? "album" : "track";
}

/**
 * Le gain (dB) d'une source — seulement ses valeurs : le navigateur ne lit pas
 * les étiquettes ReplayGain du fichier. Rabattu pour ne pas écrêter, et jamais
 * au-dessus de 0 dB (un gain positif ne peut pas s'appliquer ici).
 */
export function sourceGainDb(mode: EffectiveGainMode, source: PlaybackSource): number {
  const rg = source.replayGain;
  if (mode === "off" || rg === null) return 0;
  const gain = mode === "album" ? rg.albumGainDb ?? rg.trackGainDb : rg.trackGainDb ?? rg.albumGainDb;
  if (gain === null || !Number.isFinite(gain)) return 0;
  const peak = mode === "album" ? rg.albumPeak ?? rg.trackPeak : rg.trackPeak ?? rg.albumPeak;
  const safe = peak !== null && peak > 0 ? Math.min(gain, -20 * Math.log10(peak)) : gain;
  return Math.min(MAX_GAIN_DB, Math.max(-30, safe));
}

/**
 * Le volume de l'élément : le volume voulu (0..1) en courbe perceptuelle
 * (cubique, comme mpv — le même curseur sonne pareil sur les deux moteurs),
 * fois le gain.
 */
export function elementVolume(volume: number, gainDb: number): number {
  const v = Math.min(1, Math.max(0, volume));
  return Math.min(1, Math.max(0, v * v * v * 10 ** (gainDb / 20)));
}

/** Combien de temps avant la fin du courant lancer le suivant (ms). */
export function nextStartDelayMs(remainingS: number, startLatencyMs: number): number {
  return Math.max(0, remainingS * 1000 - startLatencyMs);
}

/** La latence de démarrage retenue : moyenne glissante, bornée (un démarrage lent isolé ne la ruine pas). */
export function nextLatencyEstimate(previousMs: number, measuredMs: number): number {
  const clamped = Math.min(250, Math.max(0, measuredMs));
  return Math.round(previousMs * 0.7 + clamped * 0.3);
}

/** Les types MIME sondés, par codec du contrat. */
const PROBES: ReadonlyArray<readonly [string, readonly string[]]> = [
  ["flac", ["audio/flac", "audio/x-flac"]],
  ["alac", ['audio/mp4; codecs="alac"']],
  ["wav", ["audio/wav", 'audio/wav; codecs="1"']],
  ["opus", ['audio/ogg; codecs="opus"', 'audio/webm; codecs="opus"']],
  ["vorbis", ['audio/ogg; codecs="vorbis"']],
  ["aac", ['audio/mp4; codecs="mp4a.40.2"', "audio/aac"]],
  ["mp3", ["audio/mpeg"]],
];

/** Les codecs que CE navigateur dit lire (`canPlayType`) ; jamais le DSD. */
export function codecsFrom(canPlayType: (mime: string) => string): string[] {
  return PROBES.filter(([, mimes]) => mimes.some((m) => canPlayType(m) !== "")).map(([codec]) => codec);
}

/** Le fondu de la bascule : courbes à puissance constante, `steps` pas. */
export function crossfadeCurve(steps: number): Array<{ out: number; in: number }> {
  const curve: Array<{ out: number; in: number }> = [];
  for (let i = 1; i <= steps; i += 1) {
    const x = i / steps;
    curve.push({ out: Math.cos((x * Math.PI) / 2), in: Math.sin((x * Math.PI) / 2) });
  }
  return curve;
}
