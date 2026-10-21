import type { AudioTrack, SubtitleTrack } from "./videoPlayer.types";
import type { ApplyToSeriesControl } from "../../hooks/useApplyToSeries";
import type { MediaItem, QualityDrop, QualityKey, QualityPreset, SourceQuality } from "@tentacle-tv/shared";
import type { MpvState } from "../../hooks/useDesktopPlayer";
import type { useDesktopSeekbar } from "../../hooks/useDesktopSeekbar";
import type { PlaybackRateState } from "../playerControls/usePlaybackRate";

/** L'habillage du lecteur de bureau — le même contrat pour l'habillage d'avant et pour le verre. */
export interface DesktopPlayerControlsProps {
  visible: boolean;
  state: MpvState;
  title: string;
  subtitle?: string;
  isDirectPlay: boolean;
  isEpisode: boolean;
  /** Hors ligne (auto OU manuel — les requêtes serveur sont alors
   *  court-circuitées) : panneau d'épisodes servi par les téléchargements.
   *  En ligne, panneau serveur COMPLET même en lecture locale : ouvrir le
   *  sélecteur est une action utilisateur, une requête est assumée — le
   *  « zéro réseau » ne vaut que pour la lecture passive. */
  useLocalEpisodes: boolean;
  item?: MediaItem;
  itemId?: string;
  displayAudio: AudioTrack[];
  displaySubs: SubtitleTrack[];
  curAudio: number;
  curSub: number | null;
  currentQuality: QualityKey;
  sourceQuality?: SourceQuality;
  qualityPresets?: readonly QualityPreset[];
  /** Badge « Auto » sur le palier actif du sélecteur. */
  autoQualityActive?: boolean;
  /** Pourquoi la qualité baisse en Auto — la ligne du menu Qualité (`player/qualityDrop.ts`). */
  qualityDrop?: QualityDrop | null;
  hasSettings: boolean;
  hasNextEpisode?: boolean;
  hasPreviousEpisode?: boolean;
  dur: number;
  actualPos: number;
  displayProgress: number;
  bufProg: number;
  seekbar: ReturnType<typeof useDesktopSeekbar>;
  showSettings: boolean;
  showEpisodes: boolean;
  setShowSettings: (fn: (p: boolean) => boolean) => void;
  setShowEpisodes: (fn: (p: boolean) => boolean) => void;
  closePanels: { settings: () => void; episodes: () => void };
  goBack: () => void;
  /** Réduire la lecture dans le PiP — absent là où il n'existe pas. */
  onReduce?: () => void;
  togglePause: () => void;
  skipBy: (delta: number) => void;
  toggleMute: () => void;
  setVolume: (v: number) => void;
  /** Vitesse de lecture mpv (propriété `speed`). */
  setSpeed: (v: number) => void;
  toggleFullscreen: () => void;
  handleAudioChange: (index: number) => void;
  handleSubtitleChange: (index: number | null) => void;
  onQualityChange?: (key: QualityKey) => void;
  applyToSeries?: ApplyToSeriesControl;
  onNextEpisode?: () => void;
  onPreviousEpisode?: () => void;
  /** Le taux de lecture, tenu par l'aiguillage (`DesktopPlayerControls`) : il survit au changement d'habillage. */
  speed?: PlaybackRateState;
}
