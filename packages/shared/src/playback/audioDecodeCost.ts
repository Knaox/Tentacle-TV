import type { MediaStream } from "../types/media";

/**
 * Ce que COÛTE un son décodé par l'appareil (extension FFmpeg du lecteur), en
 * millièmes d'un cœur de box — Cortex-A53 à 1,6 GHz (box net+, BCM7271).
 *
 * Mesuré le 07/10 (tâche L4) : `ffmpeg -threads 1 -benchmark`, le même
 * libavcodec que l'extension, sur un cœur du Mac (Apple M4), meilleur de 5,
 * 60 s de bruit rose (le pire cas pour un codec sans perte), en ms de
 * processeur par seconde de son :
 *
 * | Son | Débit | M4 (ms/s) |
 * |---|---|---|
 * | AAC 2.0 | 256 kb/s | 1,05 |
 * | E-AC3 5.1 | 640 kb/s | 1,33 |
 * | AC3 5.1 | 640 kb/s | 1,65 |
 * | DTS (cœur) 5.1 | 1,5 Mb/s | 3,37 |
 * | TrueHD 5.1 | 1,2 à 6,0 Mb/s | 11,2 à 15,4 |
 *
 * Le TrueHD coûte le MÊME prix quel que soit son débit (1,2 Mb/s d'une
 * sinusoïde comme 6 Mb/s de bruit : 12,8 ms/s) — c'est la reconstruction des
 * échantillons, par canal et par seconde, qui pèse. D'où un coût par
 * canal-échantillon, pas par débit.
 *
 * Passage au A53 : un cœur d'A53 à 1,6 GHz est ~12 fois plus lent qu'un cœur
 * de M4 (≈ 2 × l'A57 de la Shield, lui-même ≈ 6 à 8 × le M4 : banc A6 et
 * `docs/android-tv-lite/BANC.md`). Hypothèse à relever sur la vraie box.
 *
 * Le DTS-HD MA (cœur + extension sans perte XLL) ne se fabrique pas avec les
 * outils libres : compté comme le TrueHD (même famille sans perte), à relever.
 */

/** Facteur cœur M4 → cœur Cortex-A53 à 1,6 GHz. */
export const A53_SLOWDOWN = 12;

/** Le coût mesuré d'une seconde de son, sur un cœur de M4, pour 6 canaux à 48 kHz (ms/s). */
const M4_COST_6CH_48K: Readonly<Record<string, number>> = {
  aac: 1.05 * 3, // mesuré en stéréo : ramené à 6 canaux
  ac3: 1.65,
  eac3: 1.33,
  dts: 3.37,
  truehd: 13,
  dtshd: 13,
  flac: 2,
  opus: 2,
  mp3: 1,
  vorbis: 2,
};

/** Un codec inconnu : compté comme le plus cher des sons à perte (prudence). */
const UNKNOWN_M4_COST = 3.37;

export type AudioCostSource = Pick<MediaStream, "Codec" | "Profile" | "Channels" | "SampleRate" | "DisplayTitle">;

const DTS_HD_LOSSLESS = /dts-hd ma|dts-hd master|\bma\b|dts:x|dts-x|\bxll\b/i;

/** La famille de coût : `dtshd` pour un DTS-HD MA / DTS:X (sans perte), sinon le codec de Jellyfin. */
export function audioCostCodec(audio: AudioCostSource): string {
  const codec = (audio.Codec ?? "").toLowerCase();
  if (codec === "dca" || codec.startsWith("dts")) {
    return DTS_HD_LOSSLESS.test(`${audio.Profile ?? ""} ${audio.DisplayTitle ?? ""}`) ? "dtshd" : "dts";
  }
  if (codec === "mlp") return "truehd";
  if (codec === "e-ac-3" || codec === "ec-3") return "eac3";
  return codec;
}

/**
 * Le coût estimé du décodage de ce son sur un cœur d'A53, en millièmes de
 * cœur (100 = 10 % d'un cœur). Proportionnel aux canaux et à la fréquence.
 */
export function audioDecodeCostPerMille(audio: AudioCostSource): number {
  const base = M4_COST_6CH_48K[audioCostCodec(audio)] ?? UNKNOWN_M4_COST;
  const channels = audio.Channels && audio.Channels > 0 ? audio.Channels : 6;
  const rate = audio.SampleRate && audio.SampleRate > 0 ? audio.SampleRate : 48_000;
  return Math.round(base * (channels / 6) * (rate / 48_000) * A53_SLOWDOWN);
}
