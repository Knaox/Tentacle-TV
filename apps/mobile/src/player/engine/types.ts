import type { ReactNode, RefObject } from "react";
import type { MediaStream as JfStream } from "@tentacle-tv/shared";
import type { TextTrackEntry } from "@/hooks/usePlaybackInfoFetch";

/** Le moteur qui lit : le lecteur système (AVPlayer, ExoPlayer) ou le lecteur avancé (libmpv). */
export type PlayerEngineKind = "native" | "mpv";

/** Le réglage « Moteur vidéo » : automatique, ou l'un des deux imposé. */
export type VideoEngineSetting = "auto" | "native" | "mpv";

export type MobilePlatform = "ios" | "android";

/** Une piste audio telle que le moteur la voit au chargement (forme de react-native-video, reprise par mpv). */
export interface EngineAudioTrack {
  index: number;
  title?: string;
  language?: string;
  selected?: boolean;
}

/** Ce que le moteur annonce une fois le média ouvert. */
export interface EngineLoadData {
  duration: number;
  audioTracks: EngineAudioTrack[];
  naturalWidth?: number;
  naturalHeight?: number;
  /** Lecteur avancé seulement : plage dynamique et décodeur à l'œuvre. */
  hdr?: "sdr" | "hdr10" | "hlg" | "unknown";
  hwdec?: string;
}

export interface EngineProgressData {
  currentTime: number;
  playableDuration: number;
}

/** Un sous-titre externe (fichier à part sur le serveur, side-car local), dans son format d'origine. */
export interface ExternalSubtitleSource {
  jellyfinIndex: number;
  url: string;
  format: "ass" | "srt" | "vtt";
}

/** Ce que les gestionnaires commandent au moteur, quel qu'il soit. */
export interface PlayerEngineHandle {
  seek(seconds: number): void;
  /** Lecteur avancé : l'instantané technique (décodeur, images perdues, journal) pour « Détails » et le crochet de dev. */
  getTechnicalInfo?(): Promise<Record<string, unknown>>;
  /**
   * On quitte le lecteur : tout ce qui vit hors de l'écran s'éteint MAINTENANT
   * (moteur, image dans l'image, écran verrouillé, session audio), avant que
   * la fermeture de l'écran ne démonte la vue.
   */
  release(): void;
}

/**
 * Le contrat commun des deux surfaces vidéo : `PlayerScreen` et
 * `LocalPlayerScreen` ne connaissent pas le moteur. Les pistes sont désignées
 * par leur index Jellyfin ; le lecteur natif garde en plus la position native
 * de la piste audio, seule chose que react-native-video comprend.
 */
export interface EngineSurfaceProps {
  engine: PlayerEngineKind;
  engineRef: RefObject<PlayerEngineHandle | null>;
  /** URL du flux serveur, ou URI `file://` d'un fichier local. */
  streamUrl: string;
  headers: Record<string, string>;
  startPositionMs: number;
  isDirectPlay: boolean;
  /** Les flux Jellyfin de la source (serveur ou snapshot) : l'identité des pistes. */
  streams: readonly JfStream[];
  /** Index Jellyfin de la piste audio voulue (-1 : laisser le moteur choisir). */
  selectedAudioIndex: number;
  /** Index Jellyfin du sous-titre voulu (-1 : aucun). */
  selectedSubtitleIndex: number;
  /** Sous-titres externes que le lecteur avancé ajoute lui-même, à la demande. */
  externalSubtitles: readonly ExternalSubtitleSource[];
  /** Pistes VTT du lecteur natif Android (inchangé). */
  textTracks: TextTrackEntry[];
  /** Position de la piste audio parmi les pistes audio natives (-1 : laisser le lecteur). */
  audioTrackSelectedIndex: number;
  title: string;
  artist: string;
  paused: boolean;
  videoReady: boolean;
  currentTime: number;
  /** VTT dessiné par l'overlay du lecteur natif ; le lecteur avancé rend ses sous-titres lui-même. */
  subtitleVttUrl: string | null;
  isAirPlaying: boolean;
  /** Le spinner de premier chargement. */
  showLoading: boolean;
  overlayVisible: boolean;
  /** Change pour forcer un rechargement de la MÊME URL (nouvel essai). */
  reloadToken: string;
  /** Réglages du lecteur avancé (ignorés par le natif). */
  subtitleScale?: number;
  subtitlePosition?: number;
  subtitleDelay?: number;
  audioDelay?: number;
  onLoad: (data: EngineLoadData) => void;
  onProgress: (data: EngineProgressData) => void;
  onEnd: () => void;
  onError: (error: unknown) => void;
  onBuffering: (buffering: boolean) => void;
  onExternalPlaybackChange: (active: boolean) => void;
  /** Le moteur a changé l'état de pause de lui-même (interruption, fin de fichier). */
  onPausedChange?: (paused: boolean) => void;
  /** iOS, lecteur avancé : la sortie audio est passée sur AirPlay (ou en est revenue). */
  onAirPlayRoute?: (active: boolean) => void;
  /** L'image dans l'image s'est ouverte ou fermée. */
  onPipChange?: (active: boolean) => void;
  onSeek: (seconds: number) => void;
  onToggleOverlay: () => void;
  onSwipeDown: () => void;
  /** L'habillage (contrôles, cartes de fin) et les badges, par-dessus. */
  children?: ReactNode;
}
