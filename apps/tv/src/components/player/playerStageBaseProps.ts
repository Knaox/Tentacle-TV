import type { ElementRef } from "react";
import type { TouchableOpacity, ViewStyle } from "react-native";
import type { MediaItem, PlayerOverlay, QualityKey, SourceQuality, SubtitleCue } from "@tentacle-tv/shared";
import type { UseTVTrickplayResult } from "../../hooks/useTVTrickplay";
import type { TransportKey } from "./focus/overlayFocusCore";
import type { ExoTextTrack } from "./ExoPlayer";
import type { MPVPlayerHandle, MpvTrack } from "./MPVPlayer";

/**
 * Ce que l'orchestrateur du lecteur (`PlayerScreen`) donne à l'habillage et au
 * moteur : état, références des surfaces natives, pistes, gestes. L'habillage
 * refondu (`redesignWiring/player/playerStageTypes.ts`) l'étend ; le moteur
 * (`TVPlayerEngine`) en prend sa part. Sorti de l'ancien habillage d'Android
 * TV (`TVPlayerView`, retiré à la bascule).
 */

/** Le compte à rebours et la fiche « à suivre » de l'arbitre (`useTVPlaybackOverlay`). */
export interface AutoPlayCtx {
  countdown: number | null;
  /** "credits" = bannière ; "eof" = écran plein de fin (parité desktop). */
  source: "credits" | "eof" | null;
  nextEpisode: MediaItem | null;
  nextEpisodeTitle?: string;
  nextEpisodeDescription?: string;
  nextEpisodeImageUrl?: string;
  nextEpisodeOverview?: string;
  seriesBackdropUrl?: string;
  nextEpisodeThumbUrl?: string;
  navigateToNextEpisode: () => void;
  startAutoPlay: () => void;
  cancelAutoPlay: () => void;
}

/** L'état des contrôles du lecteur (`useTVPlayerControls`). */
export interface ControlsCtx {
  overlayVisible: boolean;
  scrubbing: boolean;
  scrubPosition: number;
  /** Badge éphémère « +30s / −10s » après un skip OSD caché */
  skipFlash: { delta: number; id: number } | null;
  speedLabel?: string | null;
  showOverlay: () => void;
  handleSkipBack: () => void;
  handleSkipForward: () => void;
  /** Bouton ⏩ : appui simple → mode scrub (l'OSD se masque, plein écran) */
  enterScrub: () => void;
  /** En mode scrub, OK sur un bouton valide le scrub au lieu d'agir */
  guardScrub: <T extends unknown[]>(fn: (...args: T) => void) => (...args: T) => void;
}

export interface PlayerStageBaseProps {
  // Item & state
  item?: MediaItem | null;
  streamUrl: string;
  paused: boolean;
  /** Pause EFFECTIVE de la surface (paused || reloadHold) : garde le lecteur en pause pendant un reload
   *  de piste ou de qualité (anti son sortant) sans changer l'intention `paused` (OSD/reporting). Défaut = paused. */
  playerPaused?: boolean;
  isLoading: boolean;
  /** Lecture déjà démarrée — distingue chargement initial / rebuffering */
  hasStarted: boolean;
  videoError: string | null;
  /** Cap automatique de qualité actif (débit mesuré insuffisant) → badge 5 s. */
  autoCapActive?: boolean;
  /** Débits (bits/s) qui ont motivé le cap : affichés dans le message. */
  autoCapReason?: { measuredBps?: number; sourceBps?: number };
  displayTime: number;
  bufferedTime: number;
  displayDuration: number;
  showSettings: boolean;
  autoPlayActive: boolean;
  hasPreviousEpisode: boolean;

  // Player refs
  useExoPlayer: boolean;
  /** Direct play vs transcode HLS (décision serveur) — gate le sideload tvOS. */
  isDirectPlay: boolean;
  /** tvOS/PrismCore : rendition OCR du sous-titre image sélectionné (index AVPlayer). */
  prismTextTrackIndex?: number | null;
  /** Android TV : cadence du flux, pour caler la fréquence d'affichage (ExoPlayer). */
  frameRate?: number;
  exoRef: React.Ref<MPVPlayerHandle>;
  mpvRef: React.Ref<MPVPlayerHandle>;
  backgroundRef: React.Ref<ElementRef<typeof TouchableOpacity>>;
  playerStyle: ViewStyle;

  // Tracks / qualité
  audioTracksList: { index: number; label: string }[];
  subtitleTracksList: { index: number; label: string }[];
  audioIndex: number;
  subtitleIndex: number;
  qualityKey: QualityKey;
  sourceQuality?: SourceQuality;
  /** Ce que l'arbitre partagé demande d'afficher — un passage, une carte, rien. */
  overlay: PlayerOverlay;
  /** Saut manuel du bouton, et refus du passage courant. */
  onSkipSegment: () => void;
  onDismissSegment: () => void;
  /** La PILULE « aller à l'épisode suivant » — l'arbitre la propose quand la
   *  fiche « à suivre » ne parle pas (scène post-générique, fiche éteinte). */
  onPlayNextNow: () => void;
  /** Le bouton d'habillage visé par `osdFocusSignal`, quand il est nommé. */
  osdFocusTargetRef?: { readonly current: TransportKey | undefined };
  autoPlay: AutoPlayCtx;
  controls: ControlsCtx;

  // Handlers
  onLoad: (duration: number) => void;
  /** Android : première image posée, son prêt ; départ réel du son (tv-core `startGate`). */
  onFirstFrame?: (audioFollows: boolean) => void;
  onAudioStarted?: () => void;
  onProgress: (currentTime: number, buffered: number) => void;
  onEnd: () => void;
  onError: (error: string) => void;
  onTracks: (tracks: MpvTrack[]) => void;
  onVideoSize: (width: number, height: number, pixelRatio: number) => void;
  onPlayPause: () => void;
  onBack: () => void;
  onToggleSettings: () => void;
  onSelectAudio: (index: number) => void;
  onSelectSubtitle: (index: number) => void;
  onSelectQuality: (key: QualityKey) => void;
  onCloseSettings: () => void;
  onPrevEpisode: () => void;
  onNextEpisode: () => void;
  /** Vignettes de prévisualisation pendant le scrub */
  trickplay?: UseTVTrickplayResult;
  /** Position figée (s) à afficher pendant un reload doux (audio/qualité) ;
   *  null = pas de reload doux en cours. */
  reloadFrameSec?: number | null;
  /** Incrémenter pour refocus le dernier bouton OSD utilisé */
  osdFocusSignal?: number;
  /** Cue de sous-titres texte rendue en JS (useTVSubtitles) — MPV/transcode */
  subtitleCue?: SubtitleCue | null;
  /** Pistes texte natives d'ExoPlayer (moteur) : vides, tout le texte passe par le calque JS. */
  textTracks?: ExoTextTrack[];
  /** Panneau Saisons & épisodes (séries) */
  showEpisodes?: boolean;
  onToggleEpisodes?: () => void;
  onCloseEpisodes?: () => void;
  onSelectEpisode?: (episode: MediaItem) => void;
  /** Dismiss de l'écran de FIN (« Ignorer ») : à la vraie fin → retour fiche média. */
  onEofDismiss?: () => void;
}
