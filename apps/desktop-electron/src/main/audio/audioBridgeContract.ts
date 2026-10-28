/**
 * Octave — le pont du moteur audio natif : ce que la page envoie à la coquille
 * et ce qu'elle en reçoit. Le MÊME pont pour le bureau (mpv dans Electron) et
 * le mobile (module natif `octave-audio` : mpv sur iOS, Media3 sur Android).
 *
 * ⚠️ Fichier MIROIR : `apps/desktop-electron/src/main/audio/audioBridgeContract.ts`
 * et `packages/shared/src/octave/engine/audioBridgeContract.ts`, octet pour octet
 * (le test `audioBridgeMirror.test.ts` le tient) : la coquille est compilée sans
 * dépendre de la page, ni de `@tentacle-tv/shared`. On modifie l'un, puis `cp`.
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
  /**
   * Ce que le SYSTÈME affiche du titre (écran verrouillé, Centre de contrôle, notification média) : le mobile
   * le publie, le bureau l'ignore. Pochette en adresse ABSOLUE, déjà authentifiée si elle vient du serveur.
   */
  meta?: AudioBridgeTrackMeta;
}

export interface AudioBridgeTrackMeta {
  title: string;
  artist: string | null;
  album: string | null;
  artworkUrl: string | null;
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
   * MOBILE : `url` EST le flux direct, déjà jugé par la page (hôte déclaré, https) — le natif l'ouvre SANS les
   * en-têtes du serveur et, à son premier échec, lit `fallbackUrl` (le serveur, `direct=failed`) à la même
   * position. Jamais posé par le bureau, qui juge `direct` lui-même ; un natif qui ne le connaît pas refuse
   * l'adresse (hors du serveur) : la page ne le pose que si le module déclare `directStreams`.
   */
  open?: "direct";
  fallbackUrl?: string;
  /**
   * Lire la copie de ce titre GARDÉE HORS LIGNE par ce compte (capacité `offline.music`) : la coquille cherche le
   * fichier dans SA base de transferts — la page ne désigne jamais un chemin — et, s'il manque, lit `url`.
   * `trackKey` : la clé sous laquelle la copie est gardée quand le titre a changé d'identité depuis (une entrée
   * importée rapprochée de sa source) ; absente : celle du titre.
   */
  kept?: { userId: string; trackKey?: string };
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
  engine: "mpv" | "media3";
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
  | { action: "replayGain"; mode: AudioBridgeReplayGainMode }
  /** La transition douce : durée réglée (ms, 0 = coupée) — la coquille prépare sa seconde instance. */
  | { action: "crossfade"; value: number };

/**
 * `audio_set_next` : le suivant, et la durée du fondu enchaîné vers lui que la PAGE a décidée
 * (`crossfadeRules.ts` : jamais dans un album écouté dans l'ordre…) — absente ou 0 : enchaînement sans blanc.
 */
export interface AudioBridgeSetNext {
  track: AudioBridgeTrack | null;
  source: AudioBridgeSource | null;
  crossfadeMs?: number;
}

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
  | { type: "swapped"; trackKey: string; origin: "library" | "plugin" }
  /**
   * Une commande du SYSTÈME (écran verrouillé, notification, casque, appel, sortie débranchée) : la file et
   * l'intention « lecture » sont dans la page, la coquille transmet. Une pause qui ne peut pas attendre (casque
   * débranché, appel) est déjà faite quand elle arrive ; la position, la coquille l'applique seule.
   */
  | { type: "remote"; command: AudioBridgeRemoteCommand };

export type AudioBridgeRemoteCommand = "play" | "pause" | "next" | "previous";
