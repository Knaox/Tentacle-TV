import type { LibraryEntry, LibraryIndex } from "../candidates/libraryIndex";
import type { PlayedEpisode } from "../anchorTypes";
import type { SignalItem, UserSignals } from "../signals";

/**
 * Le banc de recommandation : un PERSONA (un historique écrit à la main) devient
 * les signaux qu'un vrai compte donnerait au moteur — titres vus, aimés,
 * abandonnés, refusés — sur la VRAIE bibliothèque relevée. Pur : ni base, ni
 * réseau, ni horloge (l'appelant fournit « maintenant »).
 */

/** Un titre de la bibliothèque relevé par le banc — sans aucune donnée de compte. */
export interface BenchLibraryEntry {
  itemId: string;
  name: string;
  key: string;
  mediaType: "movie" | "tv";
  tmdbId: number;
  hasPrimaryImage: boolean;
  hasBackdrop: boolean;
  communityRating: number | null;
  Genres?: string[];
  Studios?: Array<{ Name?: string }>;
  ProductionYear?: number;
  RunTimeTicks?: number;
  ProviderIds?: Record<string, string>;
  /** Épisodes d'une série (RecursiveItemCount), 0 pour un film. */
  episodeCount: number;
}

/** Ce que le persona a fait d'un titre. `rated:N` n'existe qu'au banc hors ligne. */
export type PersonaSignal = "loved" | "watched" | "abandoned" | "refused" | "watchlist" | `rated:${number}`;

export interface PersonaEvent {
  key: string;
  title?: string;
  signal: PersonaSignal;
  /** Il y a combien de jours (défaut : 60). */
  daysAgo?: number;
  /** Épisodes vus d'une série (défaut : tous). */
  episodes?: number;
}

export interface PersonaRef {
  key: string;
  title?: string;
}

export type PersonaUniverse = "anime" | "kidsAnimation" | "franchise";

export interface Persona {
  id: string;
  label: string;
  description?: string;
  /** Comptes du serveur que ce persona représente (une famille : 3) — pouls, communauté. */
  accounts?: number;
  history: PersonaEvent[];
  /** Ce qui DOIT ressortir (écrit avant de lancer le moteur). */
  expected: PersonaRef[];
  /** Ce qui ne doit PAS ressortir. */
  avoid: PersonaRef[];
  /** Univers jamais regardés : tout titre qui en est compte comme un intrus. */
  avoidUniverses?: PersonaUniverse[];
}

export interface PersonaInputs {
  signals: UserSignals;
  ratings: Array<{ mediaType: string; tmdbId: number; score: number; updatedAt: Date }>;
  feedback: Array<{ itemKey: string; action: string; createdAt: Date }>;
  /** « J'aime » d'un titre ADORÉ hors bibliothèque (le cœur d'une fiche Vigie). */
  likes: Array<{ mediaType: string; tmdbId: number; createdAt: Date }>;
  /** La bibliothèque vue par CE compte (vu, favori, Ma liste, entamé). */
  library: LibraryIndex;
  /** Exclusions portées par la base (notes, refus). */
  accountKeys: string[];
  /** Titres de l'historique absents de la bibliothèque (ignorés). */
  missing: string[];
}

const TICKS_PER_MINUTE = 600_000_000;
const DAY_MS = 86_400_000;
const DEFAULT_EPISODE_MINUTES = 45;
const DEFAULT_DAYS_AGO = 60;
const ABANDON_SHARE = 0.1;

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function baseItem(entry: BenchLibraryEntry): SignalItem {
  return {
    Id: entry.itemId,
    Name: entry.name,
    Type: entry.mediaType === "movie" ? "Movie" : "Series",
    ProviderIds: entry.ProviderIds ?? { Tmdb: String(entry.tmdbId) },
    Genres: entry.Genres,
    Studios: entry.Studios,
    ProductionYear: entry.ProductionYear,
    RunTimeTicks: entry.RunTimeTicks,
  };
}

/** La copie de la bibliothèque sans aucune trace de compte : le point de départ de chaque persona. */
export function blankLibrary(entries: readonly BenchLibraryEntry[]): LibraryIndex {
  const out: LibraryEntry[] = entries.map((e) => ({
    itemId: e.itemId,
    name: e.name,
    key: e.key,
    mediaType: e.mediaType,
    tmdbId: e.tmdbId,
    played: false,
    isFavorite: false,
    inWatchlist: false,
    inProgress: false,
    playedEpisodes: 0,
    hasPrimaryImage: e.hasPrimaryImage,
    hasBackdrop: e.hasBackdrop,
    communityRating: e.communityRating,
    Genres: e.Genres,
    Studios: e.Studios,
    ProductionYear: e.ProductionYear,
    RunTimeTicks: e.RunTimeTicks,
    ProviderIds: e.ProviderIds,
  }));
  return { byKey: new Map(out.map((e) => [e.key, e])), entries: out };
}

/**
 * Les signaux d'un persona. Les dates sont étalées d'au moins une minute (un
 * marquage en masse — quatre titres dans la même minute — vaudrait « vu il y a
 * longtemps », cf. anchorSignals). Les épisodes d'une série s'étalent sur ses
 * jours de visionnage, le plus récent à `daysAgo`.
 */
export function personaInputs(persona: Persona, entries: readonly BenchLibraryEntry[], now: number): PersonaInputs {
  const byKey = new Map(entries.map((e) => [e.key, e]));
  const library = blankLibrary(entries);
  const signals: UserSignals = {
    favorites: [], watchlist: [], playedMovies: [], resumable: [],
    episodesPlayedBySeries: new Map(), lastPlayedBySeries: new Map(), playedEpisodes: [], seriesById: new Map(),
  };
  const ratings: PersonaInputs["ratings"] = [];
  const feedback: PersonaInputs["feedback"] = [];
  const likes: PersonaInputs["likes"] = [];
  const missing: string[] = [];
  let minute = 0;
  const stamp = (daysAgo: number) => iso(now - daysAgo * DAY_MS - (minute++) * 61_000);

  for (const event of persona.history) {
    const days = event.daysAgo ?? DEFAULT_DAYS_AGO;
    const [mediaType, idRaw] = event.key.split(":");
    if (event.signal === "refused") {
      feedback.push({ itemKey: event.key, action: "dismissed", createdAt: new Date(now - days * DAY_MS) });
      continue;
    }
    if (event.signal.startsWith("rated:")) {
      const score = Number(event.signal.slice("rated:".length));
      ratings.push({ mediaType: mediaType === "movie" ? "movie" : "series", tmdbId: Number(idRaw), score, updatedAt: new Date(now - days * DAY_MS) });
      continue;
    }
    const entry = byKey.get(event.key);
    if (!entry) {
      // Adoré mais absent de la bibliothèque : un « j'aime » de fiche, comme le ferait le compte.
      if (event.signal === "loved") likes.push({ mediaType: mediaType === "movie" ? "movie" : "tv", tmdbId: Number(idRaw), createdAt: new Date(now - days * DAY_MS) });
      else missing.push(event.key);
      continue;
    }
    const flags = library.byKey.get(event.key)!;
    const item = baseItem(entry);
    if (entry.mediaType === "tv") signals.seriesById.set(entry.itemId, item);
    if (event.signal === "watchlist") {
      signals.watchlist.push({ ...item, UserData: { Likes: true } });
      flags.inWatchlist = true;
      continue;
    }
    if (event.signal === "abandoned") {
      const runtime = entry.RunTimeTicks || DEFAULT_EPISODE_MINUTES * TICKS_PER_MINUTE;
      const resumable: SignalItem = entry.mediaType === "movie"
        ? { ...item, RunTimeTicks: runtime, UserData: { PlaybackPositionTicks: runtime * ABANDON_SHARE, LastPlayedDate: stamp(Math.max(days, 31)) } }
        : { Id: `${entry.itemId}:e1`, Type: "Episode", SeriesId: entry.itemId, RunTimeTicks: runtime,
            UserData: { PlaybackPositionTicks: runtime * ABANDON_SHARE, LastPlayedDate: stamp(Math.max(days, 31)) } };
      signals.resumable.push(resumable);
      if (entry.mediaType === "tv") flags.inProgress = true;
      continue;
    }
    // « loved » et « watched » : vu en entier ; « loved » met aussi le cœur.
    if (event.signal === "loved") {
      signals.favorites.push({ ...item, UserData: { IsFavorite: true } });
      flags.isFavorite = true;
    }
    if (entry.mediaType === "movie") {
      signals.playedMovies.push({ ...item, UserData: { Played: true, PlayCount: 1, LastPlayedDate: stamp(days) } });
      flags.played = true;
      continue;
    }
    const total = Math.max(1, entry.episodeCount || 10);
    const seen = Math.min(total, event.episodes ?? total);
    const runtime = entry.RunTimeTicks || DEFAULT_EPISODE_MINUTES * TICKS_PER_MINUTE;
    for (let i = 0; i < seen; i++) {
      // Trois épisodes par soirée, une soirée tous les deux jours, le dernier à `daysAgo`.
      const episodeDays = days + Math.floor((seen - 1 - i) / 3) * 2;
      const ep: PlayedEpisode & SignalItem = {
        Id: `${entry.itemId}:e${i + 1}`, Type: "Episode", SeriesId: entry.itemId, RunTimeTicks: runtime,
        UserData: { Played: true, PlayCount: 1, LastPlayedDate: stamp(episodeDays) },
      };
      signals.playedEpisodes.push(ep);
    }
    signals.episodesPlayedBySeries.set(entry.itemId, seen);
    flags.playedEpisodes = seen;
    if (seen >= total) flags.played = true;
    else flags.inProgress = true;
  }
  const accountKeys = [
    ...ratings.map((r) => `${r.mediaType === "movie" ? "movie" : "tv"}:${r.tmdbId}`),
    ...feedback.map((f) => f.itemKey),
    ...likes.map((l) => `${l.mediaType}:${l.tmdbId}`),
  ];
  return { signals, ratings, feedback, likes, library, accountKeys, missing };
}

/** Le persona sans un titre — le « leave-one-out » : peut-on le retrouver ? */
export function personaWithout(persona: Persona, key: string): Persona {
  return { ...persona, history: persona.history.filter((e) => e.key !== key) };
}

/** Les titres que le persona a regardés (vus, aimés, suivis) — sa matière pour le pouls et la communauté. */
export function watchedKeys(persona: Persona): string[] {
  return persona.history.filter((e) => e.signal === "loved" || e.signal === "watched").map((e) => e.key);
}
