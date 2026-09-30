import type { SubtitleCue } from "@tentacle-tv/shared";
import type { ArtworkPalette } from "../../color/artworkPalette";
import type { MetaItem } from "../../hero/MetaLine";

/**
 * Le contrat de l'habillage du lecteur : ce que `PlayerChromeView` reçoit,
 * tout résolu. Aucune donnée n'y est lue, aucun moteur n'y est chargé — la
 * vidéo vit SOUS la vue, l'intégration la pose.
 *
 * Les temps sont en SECONDES ; les textes arrivent traduits (`playerLabels.ts`
 * fabrique ceux qui ne dépendent que de la langue).
 */

/** Une image plein cadre : l'image entière, ou une case d'une planche de
 *  vignettes (trickplay Jellyfin) — position et taille en pixels source. */
export interface FrameImage {
  uri: string;
  crop?: { x: number; y: number; width: number; height: number; sheetWidth: number; sheetHeight: number };
}

export interface PlayerMedia {
  /** Le film, ou la série d'un épisode. */
  title: string;
  logoUri?: string;
  /** « S1 · E3 · Morgan VS Luffy ! » — absent pour un film. */
  subtitle?: string;
  /** Le fond de l'écran de chargement (Backdrop du film ou de la série). */
  backdropUri?: string;
  /** Les pastilles de la source (4K, Dolby Vision, Atmos…), en haut à droite. */
  badges?: MetaItem[];
}

/** L'ouverture du média — l'écran de chargement couvre tout tant qu'elle dure. */
export type PlayerPhase =
  /** Résolution du flux ; `step` : le jalon PrismCore (tvOS), « étape 3 sur 4 ». */
  | { kind: "resolving"; step?: { label: string; index: number; count: number } | null }
  /** Flux trouvé, première image attendue. */
  | { kind: "starting" }
  | { kind: "failed"; message: string }
  | { kind: "playing" };

/** Un passage connu du média (intro, résumé, générique…), en secondes. */
export interface TimelineSegment {
  start: number;
  end: number;
}

export interface PlayerTimeline {
  position: number;
  duration: number;
  /** Jusqu'où le flux est en mémoire. */
  buffered: number;
  /** Les passages que la frise marque d'une coupure (`OsdTimeline`). */
  segments?: TimelineSegment[];
}

export interface PlayerTransport {
  hasPrevious: boolean;
  hasNext: boolean;
  /** Une série : le bouton « Épisodes ». */
  hasEpisodes: boolean;
  seekBackSeconds: number;
  seekForwardSeconds: number;
}

/** Le défilement plein écran : l'image visée, où, et à quelle vitesse. */
export interface ScrubModel {
  target: number;
  speed?: { factor: number; backward: boolean } | null;
  frame?: FrameImage | null;
}

/** Un décompte : ce qui reste, sur combien. */
export interface Countdown {
  remaining: number;
  total: number;
}

/**
 * La pilule de saut — un passage (intro, résumé, aperçu, générique,
 * post-générique), la fin d'un film, ou « aller à l'épisode suivant ».
 * `label` porte déjà son décompte (« Passer l'intro dans 5 s »).
 */
export interface SkipPillModel {
  kind: "segment" | "end" | "next";
  label: string;
  countdown?: Countdown | null;
  /** Le passage part tout seul : « Masquer » est offert, à côté. */
  refusable: boolean;
}

/** La carte « À suivre » du générique. */
export interface UpNextModel {
  imageUri?: string;
  /** « S1 · E4 ». */
  code?: string;
  title: string;
  overview?: string;
  /** « Épisode suivant dans 8 s » ; absent : lecture auto éteinte. */
  countdownLabel?: string;
  countdown?: Countdown | null;
}

/** L'affiche plein écran de la vraie fin d'un épisode. */
export interface EndScreenModel extends UpNextModel {
  seriesTitle: string;
  logoUri?: string;
  backdropUri?: string;
  palette?: ArtworkPalette;
}

export interface SeasonTabModel {
  id: string;
  label: string;
  /** Nombre d'épisodes. */
  count?: number;
  /** La saison de l'épisode en cours. */
  current?: boolean;
  watched?: boolean;
}

export interface EpisodeRowModel {
  id: string;
  /** « Épisode 3 · 59 min · 23/11/1999 ». */
  kicker: string;
  title: string;
  overview?: string;
  imageUri?: string;
  /** 0 à 1, épisode entamé. */
  progress?: number;
  watched?: boolean;
  /** L'épisode en cours de lecture. */
  current?: boolean;
}

export interface EpisodesPanelModel {
  seriesTitle: string;
  seasons: SeasonTabModel[];
  activeSeasonId: string;
  episodes: EpisodeRowModel[];
  loading?: boolean;
}

export interface TrackOptionModel {
  key: string;
  label: string;
  /** Une seconde ligne : le débit d'un palier, la définition de l'original. */
  detail?: string;
  /** Pastilles de texte (DV, HDR, Atmos). */
  badges?: string[];
  selected: boolean;
  /** Choisi par le plafond automatique de débit : pastille « Auto ». */
  auto?: boolean;
}

export interface TracksPanelModel {
  audio: TrackOptionModel[];
  subtitles: TrackOptionModel[];
  /** Vide : pas de choix de qualité (colonne absente). */
  quality: TrackOptionModel[];
}

export type PlayerPanel =
  | { kind: "episodes"; episodes: EpisodesPanelModel }
  | { kind: "tracks"; tracks: TracksPanelModel };

/** Les textes fixes de l'habillage (`playerChromeLabels`). */
export interface PlayerLabels {
  back: string;
  play: string;
  pause: string;
  seekBack: string;
  seekForward: string;
  seekMode: string;
  previous: string;
  next: string;
  episodes: string;
  tracks: string;
  dismiss: string;
  playNow: string;
  backToDetails: string;
  upNext: string;
  nowPlaying: string;
  retry: string;
  audio: string;
  subtitles: string;
  quality: string;
  auto: string;
  close: string;
  scrubConfirm: string;
  scrubCancel: string;
}

export type { SubtitleCue };
