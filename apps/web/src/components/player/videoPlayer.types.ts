import type { MediaItem, SegmentTimestamps, QualityKey, QualityPreset, SourceQuality } from "@tentacle-tv/shared";
import type { PlayerTransportRef } from "../../watchTogether/playerTransport";
import type { ApplyToSeriesControl } from "../../hooks/useApplyToSeries";

export interface SubtitleTrack {
  index: number;
  label: string;
  url: string;
  lang?: string;
  codec?: string;
  /** Piste forcée — connue des side-cars locaux (leur nom de fichier la porte). */
  forced?: boolean;
  /**
   * Sous-titre EXTERNE au conteneur (fichier séparé côté serveur, side-car
   * local). Il n'est PAS dans la track-list de mpv : jamais adressable par
   * `sid`, il passe par `sub-add` — et il ne compte pas dans le rang
   * positionnel des pistes internes.
   */
  external?: boolean;
}
export interface AudioTrack { index: number; label: string; lang?: string }

export interface VideoPlayerProps {
  src: string;
  itemId: string;
  item?: MediaItem;
  mediaSourceId?: string;
  title: string;
  subtitle?: string;
  startPositionSeconds?: number;
  jellyfinDuration?: number;
  subtitleTracks?: SubtitleTrack[];
  audioTracks?: AudioTrack[];
  currentAudio: number;
  currentSubtitle: number | null;
  currentQuality: QualityKey;
  sourceQuality?: SourceQuality;
  /** Paliers de qualité calculés d'après la source (cf. construireEchelleQualite). */
  qualityPresets?: readonly QualityPreset[];
  isDirectPlay?: boolean;
  streamOffset?: number;
  /** Force native HLS via WKWebView/AVFoundation (skip hls.js). */
  useNativeHls?: boolean;
  onAudioChange: (index: number) => void;
  onSubtitleChange: (index: number | null) => void;
  onQualityChange?: (key: QualityKey) => void;
  onProgress?: (seconds: number, paused: boolean) => void;
  onStarted?: () => void;
  onSeekRequest?: (seconds: number) => void;
  onSeekComplete?: (seconds: number, paused: boolean) => void;
  /**
   * La piste audio demandée est absente du lecteur, alors qu'on lit le fichier
   * en direct : la puce ne sait pas la décoder. Il faut la demander au serveur.
   */
  surPisteIntrouvable?: () => void;
  /**
   * La lecture directe n'a rien produit — conteneur accepté puis muet. Fourni
   * seulement quand un repli est possible ; son absence désarme la garde.
   */
  onDirectPlayNonFiable?: (seconds: number) => void;
  /**
   * Piste PGS à dessiner côté client (`.sup`), au lieu de la faire incruster
   * par le serveur. `null` quand aucune piste image n'est active : l'overlay
   * n'est alors pas monté du tout.
   */
  pgsSubtitleUrl?: string | null;
  /** Le décodage PGS a échoué : rendre la main à l'incrustation serveur. */
  onPgsEchec?: () => void;
  hasNextEpisode?: boolean;
  hasPreviousEpisode?: boolean;
  nextEpisodeTitle?: string;
  nextEpisodeImageUrl?: string;
  nextEpisodeDescription?: string;
  /** Interrupteur admin « Déclenchement auto-play » (bannière + auto-next). */
  autoplayNextEnabled?: boolean;
  /** Seuil (%) = MaxResumePct Jellyfin : la bannière apparaît à ce % de lecture. */
  maxResumePct?: number;
  onNextEpisode?: () => void;
  onPreviousEpisode?: () => void;
  introSegment?: SegmentTimestamps | null;
  creditsSegment?: SegmentTimestamps | null;
  /** Backdrop affiché pendant le chargement initial du média. */
  posterUrl?: string;
  /** Watch Together — surface de commande impérative (play/pause/seek/rate). */
  transportRef?: PlayerTransportRef;
  /** Watch Together — transition lecture/pause immédiate (événements play/pause). */
  onPlayStateChange?: (paused: boolean) => void;
  /** Watch Together — entrée/sortie de mise en mémoire tampon (debounce 800 ms). */
  onBufferingChange?: (buffering: boolean) => void;
  /** Watch Together — erreur média fatale (decode/src) : le membre ne peut pas lire. */
  onFatalError?: () => void;
  /** Watch Together — l'utilisateur a masqué la bannière auto-next (à propager). */
  onAutoNextDismiss?: () => void;
  /** Visibilité de l'overlay lecteur (contrôles) — synchronise les overlays externes. */
  onControlsVisibilityChange?: (visible: boolean) => void;
  /** Épisode : case « Appliquer à cette série » (préférence de langues). */
  applyToSeries?: ApplyToSeriesControl;
}
