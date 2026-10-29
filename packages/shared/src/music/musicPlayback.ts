/**
 * Octave — la lecture : la source d'un titre et le PORT du moteur audio
 * (contrat, docs/octave/CONTRATS.md).
 *
 * Le moteur (agent 2) l'implémente deux fois : libmpv en audio seul sur le
 * bureau (Electron), un repli `<audio>` sur le web. L'interface (agent 4) ne
 * parle QU'À ce port : jamais à mpv, jamais à un élément `<audio>`.
 */

import type { MusicAudioFormat, MusicTrack } from "./musicTypes";

export interface ReplayGainInfo {
  trackGainDb: number | null;
  trackPeak: number | null;
  albumGainDb: number | null;
  albumPeak: number | null;
}

/**
 * Où lire un titre. `url` est TOUJOURS un chemin du serveur Tentacle
 * (`/api/music/stream/…` pour la bibliothèque, `/api/plugins/<id>/…` pour une
 * extension) : le moteur y ajoute l'authentification comme pour la vidéo.
 */
export interface PlaybackSource {
  trackKey: string;
  url: string;
  origin: "library" | "plugin";
  /** Faux : le fichier est encore en cours d'écriture — le moteur tolère une fin provisoire et relit. */
  complete: boolean;
  /** Taille connue (octets), sinon `null` (flux qui grandit). */
  sizeBytes: number | null;
  durationMs: number | null;
  format: MusicAudioFormat | null;
  replayGain: ReplayGainInfo | null;
  /** Au-delà (ms epoch), redemander la source ; `null` : sans expiration. */
  expiresAt: number | null;
  /**
   * Un flux que CET appareil lit EN DIRECT (capacité `plugins.clientFetch`) : obtenu par une
   * requête déléguée, il n'est valable que depuis la connexion de l'appareil. https, hôte dans
   * les `mediaHosts` de l'extension, AUCUN identifiant (ni jeton, ni en-tête, ni cookie) ; à la
   * première erreur, le moteur reprend `url` (le serveur) en y ajoutant `direct=failed` une fois,
   * pour que l'extension oublie cette source. Un moteur qui ne le connaît pas l'ignore.
   */
  direct?: { url: string; expiresAt: number | null };
  /**
   * La copie GARDÉE HORS LIGNE de ce titre par ce compte (bureau, capacité `offline.music`) : le moteur natif la lit
   * depuis le disque (la coquille la cherche elle-même) et ne reprend `url` que si elle manque. Jamais posé par le
   * serveur ni par une extension ; un moteur qui ne le connaît pas lit `url`. Sur le MOBILE, `localUri` (`file://…`)
   * désigne le fichier gardé : le moteur y vit dans le même processus que la base, rien à chercher.
   */
  kept?: { userId: string; localUri?: string };
}

export type ReplayGainMode = "off" | "track" | "album" | "auto";

export interface AudioOutputDevice {
  id: string;
  name: string;
  /** La sortie exclusive (WASAPI exclusif, CoreAudio hog mode, PipeWire direct) est-elle possible ? */
  exclusiveCapable: boolean;
}

/** Ce que CE moteur sait faire — l'interface n'affiche que ce qui est vrai. */
export interface AudioEngineCapabilities {
  engine: "mpv" | "html" | "media3";
  gapless: boolean;
  exclusiveOutput: boolean;
  replayGain: boolean;
  /** Codecs décodés (minuscules : « flac », « alac », « opus », « dsd »…). */
  codecs: readonly string[];
  /** Lecture d'un fichier qui grandit puis bascule à chaud sans coupure. */
  hotSwap: boolean;
}

export type EngineStatus = "idle" | "loading" | "playing" | "paused" | "buffering" | "ended" | "error";

export interface EngineState {
  status: EngineStatus;
  /** Le titre en cours (clé), `null` à l'arrêt. */
  trackKey: string | null;
  positionMs: number;
  durationMs: number | null;
  /** 0..1 */
  volume: number;
  muted: boolean;
  /** Le format réellement décodé, une fois connu. */
  format: MusicAudioFormat | null;
  output: { deviceId: string | null; exclusive: boolean };
  /** Message court, jamais affiché tel quel (l'interface a ses mots). */
  error: string | null;
}

export type EngineEvent =
  | { type: "state"; state: EngineState }
  /** Passage au titre suivant, sans blanc (gapless) : l'interface met la file à jour. */
  | { type: "advanced"; fromKey: string | null; toKey: string | null }
  /** Le moteur a besoin de la source d'un titre (préchargement du suivant, expiration). */
  | { type: "needSource"; trackKey: string }
  | { type: "swapped"; trackKey: string; origin: PlaybackSource["origin"] }
  /**
   * Une commande du SYSTÈME (écran verrouillé, notification média, casque, appel) : le lecteur l'applique comme
   * un geste — l'intention « lecture » et la file sont les siennes. Un moteur sans contrôles système n'en émet pas.
   * `stop` : « Arrêter » de la notification, ou l'application fermée pour de bon (balayée) — le lecteur s'arrête
   * et VIDE sa file, comme le bouton « Arrêter ».
   */
  | { type: "remote"; command: "play" | "pause" | "next" | "previous" | "stop" };

/**
 * Le moteur ne connaît que des titres et des sources : la FILE (ordre,
 * aléatoire, répétition) vit dans l'interface, qui lui donne le courant et le
 * suivant. Toutes les méthodes rendent vite (aucune n'attend le son).
 */
export interface AudioEnginePort {
  readonly capabilities: AudioEngineCapabilities;
  /** Lit `track` depuis `source` à `startMs` ; la barre se met à jour AVANT le son. */
  play(track: MusicTrack, source: PlaybackSource, startMs?: number): void;
  /** Le titre suivant, préchargé pour l'enchaînement sans blanc ; `null` le retire. */
  setNext(track: MusicTrack | null, source: PlaybackSource | null): void;
  pause(): void;
  resume(): void;
  stop(): void;
  seek(positionMs: number): void;
  setVolume(volume: number): void;
  setMuted(muted: boolean): void;
  setReplayGain(mode: ReplayGainMode): void;
  /**
   * La « transition douce » (réglage de l'appareil) : durée du fondu enchaîné entre deux titres ENCHAÎNÉS, en ms
   * (0 = coupée). Optionnelle : un moteur qui ne la connaît pas enchaîne comme avant.
   */
  setCrossfade?(durationMs: number): void;
  listOutputs(): Promise<AudioOutputDevice[]>;
  setOutput(deviceId: string | null, exclusive: boolean): Promise<void>;
  /**
   * Bascule À CHAUD la source d'un titre (courant ou suivant) — cache → bibliothèque —
   * à la même position, sans coupure audible.
   */
  swapSource(trackKey: string, source: PlaybackSource): void;
  getState(): EngineState;
  subscribe(listener: (event: EngineEvent) => void): () => void;
  dispose(): void;
}
