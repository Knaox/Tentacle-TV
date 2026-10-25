/**
 * Une opération du modèle (`audioQueue.ts`) → la commande mpv qui la réalise.
 * Pur (`audioEngineOps.test.ts`) : l'ordre et les arguments exacts se lisent
 * dans les tests, jamais dans un journal.
 */

import type { AudioBridgeControl, AudioBridgeReplayGainMode } from "./audioBridgeContract";
import { edlFrom, formatFileOptions, partialStreamOptions } from "./audioOptions";
import type { QueueEntry, QueueOp } from "./audioQueue";
import { effectiveGainMode, replayGainOptions } from "./replayGain";

/** Les options d'un fichier : départ, fin provisoire tolérée, gain. */
export function entryOptions(entry: QueueEntry, mode: AudioBridgeReplayGainMode): Record<string, string> {
  const options: Record<string, string> = {};
  if (entry.startS !== null && entry.startS > 0) options["start"] = entry.startS.toFixed(6);
  Object.assign(options, partialStreamOptions(entry.source.complete));
  const gain = effectiveGainMode(mode, entry.track.albumKey, entry.neighbours);
  Object.assign(options, replayGainOptions(gain, entry.source.replayGain));
  return options;
}

/** L'adresse donnée à mpv : la source, ou l'EDL qui la fait commencer à l'instant de la bascule. */
export function entryUrl(entry: QueueEntry): string {
  return entry.edlFromS === null ? entry.source.url : edlFrom(entry.source.url, entry.edlFromS);
}

export function opArgs(op: QueueOp, mode: AudioBridgeReplayGainMode): string[] {
  switch (op.op) {
    case "load":
      return ["loadfile", entryUrl(op.entry), op.mode, "-1", formatFileOptions(entryOptions(op.entry, mode))];
    case "remove":
      return ["playlist-remove", String(op.index)];
    case "setEnd":
      return ["set", "file-local-options/end", op.seconds.toFixed(6)];
    case "clearEnd":
      return ["set", "file-local-options/end", "none"];
    case "seek":
      return ["seek", op.seconds.toFixed(6), "absolute+exact"];
    case "stop":
      return ["stop"];
  }
}

/** Les options de gain du fichier EN COURS, quand le mode change pendant la lecture. */
export function currentGainCommands(entry: QueueEntry | null, mode: AudioBridgeReplayGainMode): string[][] {
  if (entry === null) return [];
  const gain = replayGainOptions(effectiveGainMode(mode, entry.track.albumKey, entry.neighbours), entry.source.replayGain);
  return Object.entries(gain).map(([k, v]) => ["set", `file-local-options/${k}`, v]);
}

/**
 * Un réglage (volume, sourdine, ReplayGain) : met `settings` à jour et rend les
 * commandes mpv. Le volume de mpv est perceptuel (cubique) : 0..1 → 0..100.
 */
export function settingCommands(
  c: AudioBridgeControl,
  settings: { volume: number; muted: boolean; replayGain: AudioBridgeReplayGainMode },
  current: QueueEntry | null,
): string[][] {
  switch (c.action) {
    case "volume":
      settings.volume = Math.min(1, Math.max(0, c.value));
      return [["set", "volume", String(Math.round(settings.volume * 100))]];
    case "muted":
      settings.muted = c.value;
      return [["set", "mute", c.value ? "yes" : "no"]];
    case "replayGain":
      settings.replayGain = c.mode;
      return currentGainCommands(current, c.mode);
    default:
      return [];
  }
}
