/**
 * ReplayGain : quel gain pour quel titre. Pur (`replayGain.test.ts`).
 *
 * Deux sources, dans cet ordre :
 *
 * 1. Les valeurs de la SOURCE (`PlaybackSource.replayGain`, ce que le serveur
 *    sait du fichier) : appliquées par `volume-gain`, mpv ne lit plus les
 *    étiquettes (`replaygain=no`) — un seul gain, jamais deux.
 * 2. Sinon, les étiquettes du fichier, lues par mpv (`replaygain=track|album`),
 *    avec sa garde contre l'écrêtage (`replaygain-clip=yes`).
 *
 * Posées PAR FICHIER (options de `loadfile`) : dans un enchaînement sans
 * blanc, le gain change à la frontière exacte du titre suivant.
 *
 * « auto » = le gain d'ALBUM quand on écoute un album dans l'ordre (le titre
 * d'avant ou d'après est du même album), celui du TITRE sinon (aléatoire,
 * playlist) — la règle de foobar2000 et de Roon.
 */

import type { AudioBridgeReplayGain, AudioBridgeReplayGainMode } from "./audioBridgeContract";

export type EffectiveGainMode = "off" | "track" | "album";

/** Bornes de `volume-gain` : jamais plus de +12 dB (les défauts de mpv), jamais sous −30. */
const MIN_GAIN_DB = -30;
const MAX_GAIN_DB = 12;

export function effectiveGainMode(
  mode: AudioBridgeReplayGainMode,
  albumKey: string | null,
  neighbours: ReadonlyArray<string | null>,
): EffectiveGainMode {
  if (mode !== "auto") return mode;
  if (albumKey === null) return "track";
  return neighbours.some((k) => k !== null && k === albumKey) ? "album" : "track";
}

/** Le gain retenu, borné, sans jamais faire dépasser la crête de 0 dBFS. */
export function gainFromSource(mode: "track" | "album", rg: AudioBridgeReplayGain): number | null {
  const gain = mode === "album" ? rg.albumGainDb ?? rg.trackGainDb : rg.trackGainDb ?? rg.albumGainDb;
  if (gain === null || !Number.isFinite(gain)) return null;
  const peak = mode === "album" ? rg.albumPeak ?? rg.trackPeak : rg.trackPeak ?? rg.albumPeak;
  let db = gain;
  if (peak !== null && Number.isFinite(peak) && peak > 0) {
    // Crête × gain ≤ 1 : le gain se rabat là où le titre écrêterait.
    db = Math.min(db, -20 * Math.log10(peak));
  }
  return Math.min(MAX_GAIN_DB, Math.max(MIN_GAIN_DB, db));
}

/** Les options mpv d'un fichier pour ce mode. */
export function replayGainOptions(mode: EffectiveGainMode, rg: AudioBridgeReplayGain | null): Record<string, string> {
  if (mode === "off") return { replaygain: "no", "volume-gain": "0" };
  const fromSource = rg === null ? null : gainFromSource(mode, rg);
  if (fromSource !== null) return { replaygain: "no", "volume-gain": fromSource.toFixed(2) };
  return { replaygain: mode, "volume-gain": "0" };
}
