// Dérivé de Streamyfin — https://github.com/streamyfin/streamyfin
// (modules/mpv-player/src/MpvPlayer.types.ts, révision 4faddc5f du 2026-09-12),
// publié sous Mozilla Public License 2.0. Ce fichier reste couvert par la
// MPL-2.0 (https://mozilla.org/MPL/2.0/) ; adaptation Tentacle TV : contrat
// d'événements du lecteur avancé, identité des pistes par ff-index.
import type { StyleProp, ViewStyle } from "react-native";

export type MpvTrackType = "video" | "audio" | "sub";

/**
 * Une piste telle que mpv la voit. `id` est l'identifiant mpv (1 par type),
 * `ffIndex` l'index ffprobe — celui que Jellyfin appelle `MediaStream.Index` —
 * pour une piste du fichier ; un sous-titre ajouté par `sub-add` se reconnaît à
 * `externalFilename` (l'URL exacte passée à l'ajout).
 */
export interface MpvTrack {
  id: number;
  type: MpvTrackType;
  ffIndex?: number;
  external: boolean;
  externalFilename?: string;
  title?: string;
  lang?: string;
  codec?: string;
  channels?: number;
  width?: number;
  height?: number;
  selected: boolean;
  default: boolean;
  forced: boolean;
}

export type MpvHdrMode = "sdr" | "hdr10" | "hlg" | "unknown";

export interface MpvLoadEvent {
  duration: number;
  width?: number;
  height?: number;
  fps?: number;
  hdr: MpvHdrMode;
  hwdec?: string;
  tracks: MpvTrack[];
}

/** Après la première image décodée : dimensions réelles et plage dynamique. */
export interface MpvVideoParamsEvent {
  width: number;
  height: number;
  hdr: MpvHdrMode;
  hwdec?: string;
}

export interface MpvProgressEvent {
  position: number;
  duration: number;
  cacheSeconds: number;
}

export interface MpvBufferingEvent {
  buffering: boolean;
}

export interface MpvErrorEvent {
  message: string;
}

export interface MpvPlaybackStateEvent {
  paused: boolean;
}

export interface MpvPipEvent {
  active: boolean;
}

export interface MpvAirPlayRouteEvent {
  active: boolean;
}

export interface MpvTracksEvent {
  tracks: MpvTrack[];
}

export interface MpvExternalSubtitle {
  url: string;
  /** Sélectionner cette piste dès son ajout. */
  select?: boolean;
}

/**
 * La source à charger. La sélection initiale s'exprime en `ffIndex` (index
 * Jellyfin des pistes du fichier) ; les externes portent leur propre `select`.
 * `reloadToken` force un rechargement de la même URL (nouvel essai).
 */
export interface MpvSource {
  url: string;
  headers?: Record<string, string>;
  startPosition?: number;
  externalSubtitles?: MpvExternalSubtitle[];
  initialAudioFfIndex?: number;
  initialSubtitleFfIndex?: number;
  reloadToken?: string;
}

export interface MpvNowPlaying {
  title?: string;
  artist?: string;
  artworkUrl?: string;
  artworkHeaders?: Record<string, string>;
}

export interface MpvTechnicalInfo {
  videoWidth?: number;
  videoHeight?: number;
  videoCodec?: string;
  audioCodec?: string;
  fps?: number;
  videoBitrate?: number;
  audioBitrate?: number;
  cacheSeconds?: number;
  droppedFrames?: number;
  /** Décodeur réellement à l'œuvre (`hwdec-current`) : "videotoolbox" ou "no". */
  hwdec?: string;
  audioOutput?: string;
  audioChannels?: string;
  hdr?: MpvHdrMode;
  /** Les dernières lignes du journal natif, pour le panneau « Détails ». */
  log?: string[];
}

type NativeEvent<T> = (event: { nativeEvent: T }) => void;

/** Les props de la vue native (celles que `MpvPlayerModule.swift` déclare). */
export interface MpvPlayerNativeProps {
  source?: MpvSource;
  paused?: boolean;
  speed?: number;
  nowPlaying?: MpvNowPlaying;
  /** Facteur d'échelle des sous-titres (1 = taille de la piste). */
  subtitleScale?: number;
  /** Position verticale en pourcentage de la hauteur (100 = bas de l'image). */
  subtitlePosition?: number;
  /** Décalage des sous-titres en secondes (positif = plus tard). */
  subtitleDelay?: number;
  /** Décalage audio en secondes (positif = son retardé). */
  audioDelay?: number;
  pipAutoStart?: boolean;
  style?: StyleProp<ViewStyle>;
  onLoad?: NativeEvent<MpvLoadEvent>;
  onProgress?: NativeEvent<MpvProgressEvent>;
  onBuffering?: NativeEvent<MpvBufferingEvent>;
  onEnd?: NativeEvent<Record<string, never>>;
  onError?: NativeEvent<MpvErrorEvent>;
  onTracksChanged?: NativeEvent<MpvTracksEvent>;
  onVideoParams?: NativeEvent<MpvVideoParamsEvent>;
  onPipChanged?: NativeEvent<MpvPipEvent>;
  onPlaybackStateChange?: NativeEvent<MpvPlaybackStateEvent>;
  onAirPlayRoute?: NativeEvent<MpvAirPlayRouteEvent>;
}

/** Les commandes impératives de la vue, exposées par la ref. */
export interface MpvPlayerViewHandle {
  seekTo(seconds: number): Promise<void>;
  getPosition(): Promise<number>;
  /** Identifiant mpv (négatif = aucune piste). */
  setAudioTrack(id: number): Promise<void>;
  setSubtitleTrack(id: number): Promise<void>;
  addSubtitle(url: string, select: boolean): Promise<void>;
  getTracks(): Promise<MpvTrack[]>;
  getTechnicalInfo(): Promise<MpvTechnicalInfo>;
  startPictureInPicture(): Promise<void>;
  stopPictureInPicture(): Promise<void>;
  isPictureInPictureSupported(): Promise<boolean>;
  isPictureInPictureActive(): Promise<boolean>;
  /** Détruit l'instance mpv (décodeur, cache) ; la vue reste utilisable. */
  stop(): Promise<void>;
  /**
   * Quitter le lecteur : mpv, image dans l'image, écran verrouillé et session
   * audio s'éteignent pour de bon — à appeler AVANT de fermer l'écran, pendant
   * que la vue existe encore. La vue ne se relance plus.
   */
  release(): Promise<void>;
}
