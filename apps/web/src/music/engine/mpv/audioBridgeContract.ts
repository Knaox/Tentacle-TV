/**
 * Octave — le pont du moteur audio natif : ce que la page envoie à la coquille
 * et ce qu'elle en reçoit.
 *
 * ⚠️ Fichier MIROIR, recopié octet pour octet dans
 * `apps/web/src/music/engine/mpv/audioBridgeContract.ts` (le test
 * `audioBridgeMirror.test.ts` le tient) : la coquille est compilée sans
 * dépendre de la page, ni de `@tentacle-tv/shared`. On modifie ICI, puis `cp`.
 *
 * Aucun import : des types et des constantes seulement. Les formes reprennent
 * celles du port `AudioEnginePort` (`packages/shared/src/music/musicPlayback.ts`)
 * — `EngineState`, `AudioOutputDevice` —, champ pour champ.
 */

/** Les commandes du moteur audio, dans la liste fermée de `channels.ts`. */
export const AUDIO_BRIDGE_COMMANDS = [
  "audio_engine_start",
  "audio_engine_stop",
  "audio_play",
  "audio_set_next",
  "audio_swap_source",
  "audio_control",
  "audio_list_outputs",
  "audio_set_output",
  // Le niveau RMS du son qui joue (dBFS ou `null`), pour la houle d'Octave (`audio/audioLevel.ts`).
  "audio_level",
] as const;

/** L'unique évènement poussé vers la page. */
export const AUDIO_BRIDGE_EVENT = "audio://event";

export interface AudioBridgeReplayGain {
  trackGainDb: number | null;
  trackPeak: number | null;
  albumGainDb: number | null;
  albumPeak: number | null;
}

export interface AudioBridgeFormat {
  codec: string;
  container: string | null;
  sampleRate: number | null;
  bitDepth: number | null;
  bitrate: number | null;
  channels: number | null;
  lossless: boolean;
}

/** Ce que le moteur doit savoir d'un titre : sa clé, son album (ReplayGain « auto »). */
export interface AudioBridgeTrack {
  trackKey: string;
  albumKey: string | null;
  durationMs: number | null;
  /** Le format annoncé par la bibliothèque (profondeur de bits que le décodeur ne dit pas). */
  format: AudioBridgeFormat | null;
}

/** Une source de lecture, URL déjà ABSOLUE (l'origine du serveur réglée au démarrage). */
export interface AudioBridgeSource {
  url: string;
  origin: "library" | "plugin";
  complete: boolean;
  sizeBytes: number | null;
  durationMs: number | null;
  replayGain: AudioBridgeReplayGain | null;
  expiresAt: number | null;
  /**
   * Un flux que CET appareil lit en direct (requêtes déléguées) : la coquille le lit par son relais
   * local si son hôte est déclaré par l'extension, `url` (le serveur) restant le repli.
   */
  direct?: { url: string; expiresAt: number | null };
  /**
   * Lire la copie de ce titre GARDÉE HORS LIGNE par ce compte (capacité `offline.music`) : la coquille cherche le
   * fichier dans SA base de transferts — la page ne désigne jamais un chemin — et, s'il manque, lit `url`.
   */
  kept?: { userId: string };
}

export type AudioBridgeReplayGainMode = "off" | "track" | "album" | "auto";

export interface AudioBridgeStart {
  /** L'origine du serveur Tentacle : toute source qui n'en vient pas est refusée. */
  serverOrigin: string;
  /** En-têtes d'authentification posés sur chaque requête du moteur (`X-Emby-Token`…). */
  headers: Record<string, string>;
  volume: number;
  muted: boolean;
  replayGain: AudioBridgeReplayGainMode;
  deviceId: string | null;
  exclusive: boolean;
}

export interface AudioBridgeCapabilities {
  engine: "mpv";
  gapless: boolean;
  exclusiveOutput: boolean;
  replayGain: boolean;
  codecs: string[];
  hotSwap: boolean;
}

export type AudioBridgeControl =
  | { action: "pause" }
  | { action: "resume" }
  | { action: "stop" }
  | { action: "seek"; value: number }
  | { action: "volume"; value: number }
  | { action: "muted"; value: boolean }
  | { action: "replayGain"; mode: AudioBridgeReplayGainMode };

export type AudioBridgeStatus = "idle" | "loading" | "playing" | "paused" | "buffering" | "ended" | "error";

export interface AudioBridgeState {
  status: AudioBridgeStatus;
  trackKey: string | null;
  positionMs: number;
  durationMs: number | null;
  volume: number;
  muted: boolean;
  format: AudioBridgeFormat | null;
  output: { deviceId: string | null; exclusive: boolean };
  error: string | null;
}

export interface AudioBridgeOutput {
  id: string;
  name: string;
  exclusiveCapable: boolean;
}

/**
 * Ce que la coquille pousse. `at` : `Date.now()` de la mesure — la page en
 * extrapole la position entre deux états (quatre par seconde en lecture).
 */
export type AudioBridgeEvent =
  | { type: "state"; state: AudioBridgeState; at: number }
  | { type: "advanced"; fromKey: string | null; toKey: string | null }
  | { type: "needSource"; trackKey: string }
  | { type: "swapped"; trackKey: string; origin: "library" | "plugin" };
