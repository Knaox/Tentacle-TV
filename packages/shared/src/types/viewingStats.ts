/**
 * Statistiques de visionnage — le CONTRAT de `GET /api/stats/me`.
 *
 * Ce fichier est recopié octet pour octet dans le backend
 * (`apps/backend/src/services/viewingStats/contract.ts`) : le backend est
 * compilé en CommonJS et ne dépend pas de ce paquet. Le test
 * `contractMirror.test.ts` du backend tient les deux copies ensemble — on
 * modifie ICI, on recopie là-bas. Aucun import : le contrat se suffit.
 *
 * Trois natures de chiffres, que l'interface ne mélange jamais sans le dire :
 *  • MESURÉ  — chronométré par Tentacle (`watch_segments`) depuis
 *              `measuredSince` : durées réelles, rythme, appareils, records ;
 *  • ESTIMÉ  — avant `measuredSince`, la durée des titres marqués « vus »,
 *              chacun compté UNE fois (la règle du classement de visionnage) ;
 *  • COMPTÉ  — films et épisodes vus, lus de Jellyfin : exacts.
 * Le goût (`taste`) est le profil du moteur de recommandations, lu tel quel.
 */

/** La fenêtre demandée : 30 derniers jours, année civile en cours, tout. */
export type ViewingStatsPeriod = "30d" | "year" | "all";

export const VIEWING_STATS_PERIODS: readonly ViewingStatsPeriod[] = ["30d", "year", "all"];

/** Le pas de la frise : jours (30 j), mois (année, ou tout sur deux ans), années. */
export type ViewingStatsTimelineUnit = "day" | "month" | "year";

export interface ViewingStatsTimelineBucket {
  /** Début du pas en date LOCALE : « AAAA-MM-JJ », « AAAA-MM » ou « AAAA ». */
  key: string;
  measuredSeconds: number;
  estimatedSeconds: number;
}

export interface ViewingStatsTimeline {
  unit: ViewingStatsTimelineUnit;
  buckets: ViewingStatsTimelineBucket[];
  /**
   * Secondes estimées SANS date fiable (titres marqués « vus » en masse, ou
   * sans date de lecture) : comptées dans le total de « tout », absentes de
   * la frise — les placer quelque part inventerait une date.
   */
  undatedSeconds: number;
}

export interface ViewingStatsTotals {
  /** Mesuré + estimé. */
  seconds: number;
  measuredSeconds: number;
  estimatedSeconds: number;
  /** Films marqués « vus » dont la dernière lecture tombe dans la période. */
  movies: number;
  /** Épisodes marqués « vus » dans la période. */
  episodes: number;
  /** Séries distinctes dont au moins un épisode a été vu dans la période. */
  series: number;
  /** Jours locaux distincts avec au moins une lecture. */
  activeDays: number;
}

export interface ViewingStatsRhythm {
  /**
   * 168 cases : secondes MESURÉES par jour × heure locaux. Ligne par jour,
   * lundi en tête (index = jour × 24 + heure). Que des zéros sans mesure.
   */
  grid: number[];
}

/** Répartition du temps en trois natures qui ne se recouvrent pas. */
export interface ViewingStatsSplit {
  /** Films, hors animés. */
  movieSeconds: number;
  /** Séries, hors animés. */
  seriesSeconds: number;
  /** Animés — films et séries. */
  animeSeconds: number;
}

export interface ViewingStatsLabeledShare {
  /** Clé stable : id TMDB du genre (« 878 »), code ISO 639-1 de la langue (« ja »). */
  key: string;
  /** Libellé dans la langue demandée. */
  label: string;
  seconds: number;
  /** Part du temps de la période (0..1). Un titre compte dans CHACUN de ses genres. */
  share: number;
}

export interface ViewingStatsDecade {
  /** Première année de la décennie (1990). */
  decade: number;
  seconds: number;
}

/** L'application qui a servi la lecture, lue dans le nom de client Jellyfin. */
export type ViewingStatsDevice = "tv" | "mobile" | "desktop" | "web" | "webos" | "other";

export interface ViewingStatsDeviceShare {
  device: ViewingStatsDevice;
  seconds: number;
  /** Nom brut de l'application pour `other` (« Infuse », « Jellyfin Web »…), sinon null. */
  client: string | null;
}

export interface ViewingStatsTitle {
  /** Identifiant Jellyfin du film ou de la série. */
  id: string;
  name: string;
  kind: "movie" | "series";
  seconds: number;
  /** Séries : épisodes vus dans la période. Films : 0. */
  episodes: number;
  /** Films : jours distincts où la mesure l'a vu à 60 % ou plus — « revu » dès 2. */
  viewings: number;
  year: number | null;
  anime: boolean;
  primaryTag: string | null;
  backdropTag: string | null;
  /** Dernière lecture connue (ISO), null si inconnue. */
  lastPlayedAt: string | null;
}

export type ViewingStatsPersonRole = "actor" | "director";

export interface ViewingStatsPerson {
  tmdbId: number;
  name: string;
  /** Chemin d'image TMDB (« /abc.jpg »), null sans portrait. */
  profilePath: string | null;
  role: ViewingStatsPersonRole;
  /** Temps passé devant les titres où la personne figure. */
  seconds: number;
  titles: number;
}

export interface ViewingStatsRecords {
  /** La journée la plus remplie (mesure). */
  biggestDay: { date: string; seconds: number } | null;
  /** La plus longue suite de jours consécutifs avec au moins une lecture. */
  longestStreak: { days: number; from: string; to: string } | null;
  /** Le plus d'épisodes d'une même série vus le même jour. */
  binge: { seriesId: string; seriesName: string; episodes: number; date: string } | null;
  /** La plus longue séance sur un même titre (mesure). */
  longestSession: { title: string; seconds: number; date: string } | null;
}

/** Pourquoi le moteur tient un titre pour « aimé » — tiré de ses signaux. */
export type ViewingStatsTasteReason =
  | "superlike"
  | "like"
  | "favorite"
  | "rating"
  | "rewatch"
  | "series"
  | "completed";

export interface ViewingStatsTasteTitle {
  /** Clé du moteur : « movie:603 », « tv:1399 » ou « jf:<id> ». */
  key: string;
  mediaType: "movie" | "tv";
  /** 0 pour un titre de bibliothèque sans id TMDB. */
  tmdbId: number;
  title: string;
  /** Présent quand le titre est en bibliothèque : on ouvre sa fiche. */
  jellyfinId: string | null;
  /** Affiche TMDB pour un titre hors bibliothèque. */
  posterPath: string | null;
  reasons: ViewingStatsTasteReason[];
  /** Note donnée, sur 10, quand le titre a été noté. */
  rating: number | null;
  /** Heures estimées par le moteur (durée des titres vus). */
  hours: number;
}

export interface ViewingStatsSignals {
  ratings: number;
  /** Moyenne des notes, sur 10 ; null sans note. */
  ratingAverage: number | null;
  /** Coups de cœur d'« Affiner ». */
  superlikes: number;
  /** « J'aime » d'« Affiner » et titres aimés hors bibliothèque. */
  likes: number;
  /** « Pas pour moi » d'« Affiner ». */
  dislikes: number;
  likedPeople: number;
  /** Favoris Jellyfin. */
  favorites: number;
}

export interface ViewingStatsTaste {
  /** Faux tant que le moteur n'a pas calculé de profil pour ce compte. */
  available: boolean;
  computedAt: string | null;
  /** Part des animés dans le temps de visionnage selon le profil (0..1). */
  animeShare: number;
  /** Les titres qui pèsent le plus dans le goût, le plus fort d'abord. */
  loved: ViewingStatsTasteTitle[];
  signals: ViewingStatsSignals;
}

export interface ViewingStats {
  period: ViewingStatsPeriod;
  /** Fuseau IANA réellement appliqué aux jours et aux heures. */
  timeZone: string;
  generatedAt: string;
  /** Instant depuis lequel Tentacle chronomètre (ISO) ; null s'il n'a encore rien mesuré. */
  measuredSince: string | null;
  /** Faux pour un compte qui n'a encore rien regardé, toutes périodes confondues. */
  hasHistory: boolean;
  totals: ViewingStatsTotals;
  timeline: ViewingStatsTimeline;
  rhythm: ViewingStatsRhythm;
  split: ViewingStatsSplit;
  genres: ViewingStatsLabeledShare[];
  languages: ViewingStatsLabeledShare[];
  decades: ViewingStatsDecade[];
  devices: ViewingStatsDeviceShare[];
  /** Les séries les plus regardées de la période, par temps. */
  topSeries: ViewingStatsTitle[];
  /** Les films vus dans la période, le plus récent d'abord. */
  movies: ViewingStatsTitle[];
  people: { actors: ViewingStatsPerson[]; directors: ViewingStatsPerson[] };
  records: ViewingStatsRecords;
  taste: ViewingStatsTaste;
}
