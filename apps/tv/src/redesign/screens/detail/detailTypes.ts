import type { CardModel, CardQuality } from "../../cards/cardTypes";
import type { ArtworkPalette } from "../../color/artworkPalette";
import type { MetaItem } from "../../hero/MetaLine";
import type { ArrivalModel } from "../../requests/arrivalTypes";

/**
 * Le contrat de la fiche média : tout arrive RÉSOLU par l'intégration. La
 * vue ne lit jamais `UserData`, ne calcule ni l'épisode à reprendre, ni la
 * saison à ouvrir, ni les marqueurs : elle les reçoit. Seuls les libellés
 * fixes (titres de section, boutons, badges) viennent de l'i18n de la vue.
 */

/** Ce que la fiche montre. */
export type DetailKind = "movie" | "series" | "episode" | "collection";

/** Les sections, dans l'ordre de la page — ce sont aussi les ancres du défilement. */
export type DetailSectionKey = "header" | "collection" | "episodes" | "cast" | "extras" | "saga" | "similar";

export interface DetailHeaderModel {
  kind: DetailKind;
  /** Le titre de l'œuvre ; celui de l'ÉPISODE sur une fiche d'épisode. */
  title: string;
  /** Le logo (film, série) ; celui de la SÉRIE, en petit, sur une fiche d'épisode. */
  logoUri?: string;
  /** Épisode : la pastille qui mène à la série (« One Piece — S1 · E2 »). */
  seriesLink?: string;
  /** Année, classification, durée ou « N saisons », genres, ★ note globale. */
  meta: MetaItem[];
  /** 4K, HDR, Dolby Vision, Atmos, 5.1, VF, VOSTFR… — des pastilles, jamais des drapeaux. */
  badges?: MetaItem[];
  /** La note perso du compte (1 à 10) ; absente tant qu'il n'a pas noté. */
  userScore?: number | null;
  synopsis?: string;
}

export interface DetailPlayModel {
  /** « Lecture », « Reprendre », « Reprendre S2 · E5 », « Lecture S1 · E1 ». */
  label: string;
  /** 0 à 1 : la jauge d'un « Reprendre ». */
  progress?: number;
  /** Sous la pilule : « Reste 1 h 12 min ». */
  caption?: string;
}

export interface DetailActionsModel {
  /** Absent : une collection, ou une série terminée — pas de Lecture. */
  play?: DetailPlayModel | null;
  /** Le titre a une bande-annonce (`useItemTrailer().visible`). */
  trailer?: boolean;
  watchlist: boolean;
  favorite: boolean;
  watched: boolean;
  /** Absent : le titre ne peut pas être noté (pas d'identifiant TMDB). */
  rating?: { score: number | null };
}

/** Une saison dans la bande des onglets. */
export interface SeasonTabModel {
  id: string;
  /** « Saison 1 », « Spéciaux » — le nom que Jellyfin lui donne. */
  label: string;
  episodeCount?: number;
  /** `current` : la saison de l'épisode à reprendre (un point) ; `watched` : vue (une coche). */
  state?: "current" | "watched" | null;
}

/**
 * Une saison que la bibliothèque n'a PAS, au bout des onglets (série
 * incomplète, garde Vigie ouverte) : un onglet GRISÉ — son « + » la demande.
 */
export interface MissingSeasonTabModel {
  number: number;
  /** « Saison 5 », « Spéciaux », « Saison 1 · Book One: Water ». */
  label: string;
  /** Elle se demande encore (un « + ») ; sinon, elle l'est déjà (une horloge). */
  requestable: boolean;
  /** Où elle en est, dit aux lecteurs d'écran : « À demander », « Demandée ». */
  status: string;
  /** Elle fait partie d'une demande du COMPTE : son camembert et son état
   *  (« En attente », « En cours ») à la place du « + » ou de l'horloge. */
  request?: { arrival: ArrivalModel; label: string };
}

/** Reprendre (entamé), À suivre (le prochain à voir), Épisode actuel (fiche d'épisode). */
export type EpisodeBadge = "resume" | "upNext" | "current";

export interface EpisodeModel {
  id: string;
  /** Le numéro dans la saison. */
  number?: number;
  title: string;
  /** L'image 16:9 de l'épisode ; absente, la vignette dit son numéro. */
  imageUri?: string;
  /** Ce qui suit le numéro dans le surtitre : la durée (« 24min »). */
  meta?: string;
  overview?: string;
  /** 0 à 1 ; absent quand il n'y a rien à reprendre. */
  progress?: number;
  watched?: boolean;
  badge?: EpisodeBadge | null;
  /** La lumière de l'image : le halo de la vignette focalisée. */
  palette?: ArtworkPalette;
  /** La qualité de l'épisode (4K, HDR10…), montrée au focus dans l'image —
   *  lue à ce moment-là : la saison se charge sans ses flux. */
  quality?: CardQuality;
}

export interface EpisodesModel {
  seasons: SeasonTabModel[];
  /** Les saisons manquantes, grisées au bout de la bande ; absentes : rien à demander. */
  missing?: MissingSeasonTabModel[];
  selectedSeasonId?: string;
  /** `null` : la saison se charge (vignettes fantômes). */
  episodes: EpisodeModel[] | null;
  /** L'épisode sur lequel la rangée s'ouvre (reprise, épisode ouvert). */
  anchorIndex?: number;
}

export interface PersonModel {
  id: string;
  name: string;
  /** Le rôle (acteur) ou le métier. */
  role?: string;
  imageUri?: string;
  /** Sans portrait, le disque prend la lumière de son BlurHash. */
  palette?: ArtworkPalette;
}

/** Une colonne de l'équipe : « Réalisation — Joe Wright ». */
export interface CrewGroupModel {
  key: string;
  label: string;
  names: string[];
}

export interface ExtraModel {
  id: string;
  title: string;
  /** « Coulisses », « Teaser · YouTube ». */
  subtitle?: string;
  imageUri?: string;
  /** Vidéo retirée : grisée, « Indisponible ». */
  unavailable?: boolean;
}

export interface SagaEntryModel {
  key: string;
  /** La carte du volet : celle de la bibliothèque, marqueurs résolus — ou, un
   *  volet ABSENT, son affiche TMDB grisée et son badge (`card.absent`). */
  card: CardModel;
  /** « Volet 2 ». */
  rank?: string | null;
  /** « Cette fiche », « Reprendre », « À suivre » — mis en valeur. */
  cue?: string | null;
  /** Le film ouvert : la carte reste focalisable, mais inerte. */
  current?: boolean;
  /** Faux : l'appui maintenu n'ouvre rien — un volet absent, quand le serveur
   *  ne sait pas demander de titres. */
  holdable?: boolean;
}

export interface SagaModel {
  /** Le nom de la saga selon TMDB (`sagaTitle`). */
  title: string;
  /** « 8 films · 6 dans la bibliothèque · 2 vus » (`sagaSummary`). */
  summary: string;
  entries: SagaEntryModel[];
}

/** Les rappels de la fiche : chacun reçoit ce qu'il désigne. */
export interface DetailCallbacks {
  onPlay?: () => void;
  onTrailer?: () => void;
  onToggleWatchlist?: () => void;
  onToggleFavorite?: () => void;
  onToggleWatched?: () => void;
  onRate?: () => void;
  /** Fiche d'épisode : la pastille de la série. */
  onOpenSeries?: () => void;
  onSelectSeason?: (seasonId: string) => void;
  /** Un onglet qui garde le focus : précharger sa saison (`useSeasonBrowser().prefetch`). */
  onFocusSeason?: (seasonId: string) => void;
  /** OK sur une saison manquante (onglet grisé) : la feuille des saisons, sur elle. */
  onRequestSeason?: (number: number) => void;
  onPlayEpisode?: (episode: EpisodeModel) => void;
  onLongPressEpisode?: (episode: EpisodeModel) => void;
  onOpenPerson?: (person: PersonModel) => void;
  onOpenExtra?: (extra: ExtraModel) => void;
  onOpenSagaEntry?: (entry: SagaEntryModel) => void;
  /** L'appui maintenu sur un volet (`holdable`) : le grand panneau. */
  onLongPressSagaEntry?: (entry: SagaEntryModel) => void;
  /** Une affiche de la collection ou des titres similaires. */
  onOpenCard?: (section: "collection" | "similar", card: CardModel) => void;
  /** L'appui long d'une affiche : la feuille d'actions des cartes. */
  onLongPressCard?: (card: CardModel) => void;
  onRetry?: () => void;
  onBack?: () => void;
}
