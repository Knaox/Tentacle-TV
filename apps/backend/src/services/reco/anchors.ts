import {
  ANCHOR_ABANDON,
  ANCHOR_COMPLETED,
  ANCHOR_DISMISSED,
  ANCHOR_FAVORITE,
  ANCHOR_LIKE,
  ANCHOR_MAX,
  ANCHOR_MIN,
  ANCHOR_NOT_INTERESTED,
  ANCHOR_REWATCH,
  ANCHOR_REWATCH_UNVERIFIED,
  ANCHOR_WATCHLIST,
  EPISODE_FALLBACK_HOURS,
  SERIES_MIN_EPISODES,
  bulkMinutes,
  explicitDecay,
  implicitDecay,
  playAgeDays,
  seriesEngagementByHours,
  swipeAnchorWeight,
} from "./anchorSignals";
import { ratingSignalWeight, ratingStats } from "./profileMath";
import type { SignalItem } from "./signals";

/**
 * Les ANCRES du goût : un compte n'est plus une moyenne unique de facettes
 * (où l'animé, le drame et les super-héros se diluaient les uns dans les
 * autres) mais la liste des titres qui comptent pour lui, chacun avec son
 * poids signé. Le classement compare un candidat à CHACUNE — un titre très
 * proche de deux ou trois ancres fortes passe devant, quel que soit le reste.
 */
export type AnchorKind =
  | "rating"
  | "favorite"
  | "like"
  | "watchlist"
  | "completed"
  | "rewatch"
  | "series"
  | "abandon"
  | "dismissed"
  | "swipe_like"
  | "superlike"
  | "swipe_dislike";

export interface Anchor {
  /** Clé canonique « movie:603 » ; « jf:<itemId> » sans identité TMDB. */
  key: string;
  mediaType: "movie" | "tv";
  tmdbId: number;
  title: string;
  /** Poids signé, décroissance comprise, borné (ANCHOR_MIN..ANCHOR_MAX). */
  weight: number;
  /** Vu, suivi ou noté — pas seulement listé ou refusé. */
  consumption: boolean;
  /** Heures regardées (film vu : sa durée ; série : ses épisodes vus). */
  hours: number;
  /** Dernier signal DATÉ (un marquage en masse ne date rien). */
  lastAt: string | null;
  kinds: AnchorKind[];
}

export interface PlayedEpisode {
  SeriesId?: string;
  RunTimeTicks?: number;
  UserData?: { LastPlayedDate?: string | null; PlayCount?: number };
}

/** Visionnage MESURÉ d'un item Jellyfin (watch_segments). */
export interface MeasuredViewing {
  /** Jours distincts où l'item a été regardé à au moins 60 %. */
  fullDays: number;
}

export interface AnchorInputs {
  now: number;
  ratings: ReadonlyArray<{ mediaType: string; tmdbId: number; score: number; updatedAt: Date | string }>;
  likes: ReadonlyArray<{ mediaType: string; tmdbId: number; createdAt: Date | string }>;
  feedback: ReadonlyArray<{ itemKey: string; action: string; createdAt: Date | string }>;
  /** Verdicts de l'onglet « Affiner » (absent = aucun). */
  swipes?: ReadonlyArray<{ mediaType: string; tmdbId: number; verdict: string; updatedAt: Date | string }>;
  favorites: readonly SignalItem[];
  watchlist: readonly SignalItem[];
  playedMovies: readonly SignalItem[];
  resumable: readonly SignalItem[];
  playedEpisodes: readonly PlayedEpisode[];
  seriesById: ReadonlyMap<string, SignalItem>;
  measured?: ReadonlyMap<string, MeasuredViewing>;
}

export interface AnchorSet {
  anchors: Anchor[];
  /** Fiche Jellyfin de chaque ancre de bibliothèque — repli des facettes. */
  itemByKey: Map<string, SignalItem>;
}

const TICKS_PER_HOUR = 36_000_000_000;
const ABANDON_MAX_PROGRESS = 0.25;
const ABANDON_MIN_IDLE_DAYS = 30;
/** Plancher de pertinence : en deçà, une ancre ne dit rien. */
const ANCHOR_EPSILON = 0.02;

interface Acc extends Omit<Anchor, "kinds"> {
  kinds: Set<AnchorKind>;
  ratingWeights: number[];
}

function canonicalType(mediaType: string): "movie" | "tv" {
  return mediaType === "movie" ? "movie" : "tv";
}

function refOf(item: SignalItem): { key: string; mediaType: "movie" | "tv"; tmdbId: number } | null {
  const mediaType = item.Type === "Movie" ? "movie" : item.Type === "Series" ? "tv" : null;
  if (!mediaType) return null;
  const tmdbId = Number(item.ProviderIds?.Tmdb);
  if (Number.isFinite(tmdbId) && tmdbId > 0) return { key: `${mediaType}:${tmdbId}`, mediaType, tmdbId };
  // Sans identité TMDB (animé AniDB seul…) : l'ancre vit sur ses facettes Jellyfin.
  return { key: `jf:${item.Id}`, mediaType, tmdbId: 0 };
}

function laterOf(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return Date.parse(b) > Date.parse(a) ? b : a;
}

/** Construit les ancres d'un compte. Pure : l'appelant fournit les signaux. */
export function buildAnchors(input: AnchorInputs): AnchorSet {
  const { now } = input;
  const acc = new Map<string, Acc>();
  const itemByKey = new Map<string, SignalItem>();
  const ageOf = (d: Date | string) => Math.max(0, (now - new Date(d).getTime()) / 86_400_000);

  const touch = (key: string, mediaType: "movie" | "tv", tmdbId: number, title: string): Acc => {
    let a = acc.get(key);
    if (!a) {
      a = { key, mediaType, tmdbId, title, weight: 0, consumption: false, hours: 0, lastAt: null, kinds: new Set(), ratingWeights: [] };
      acc.set(key, a);
    }
    if (!a.title && title) a.title = title;
    return a;
  };
  const touchItem = (item: SignalItem) => {
    const ref = refOf(item);
    if (!ref) return null;
    if (!itemByKey.has(ref.key)) itemByKey.set(ref.key, item);
    return touch(ref.key, ref.mediaType, ref.tmdbId, item.Name ?? "");
  };

  // Dates de lecture de tout l'historique : les minutes chargées trahissent
  // les marquages en masse.
  const bulk = bulkMinutes([
    ...input.playedMovies.map((m) => m.UserData?.LastPlayedDate),
    ...input.playedEpisodes.map((e) => e.UserData?.LastPlayedDate),
  ]);

  // 1) Notes : l'échelle absolue des étoiles, moyennée par titre (saisons).
  const { stdDev } = ratingStats(input.ratings.map((r) => r.score));
  for (const r of input.ratings) {
    const mediaType = canonicalType(r.mediaType);
    const a = touch(`${mediaType}:${r.tmdbId}`, mediaType, r.tmdbId, "");
    a.ratingWeights.push(ratingSignalWeight(r.score, stdDev) * explicitDecay(ageOf(r.updatedAt)));
    a.kinds.add("rating");
    a.consumption = true;
    a.lastAt = laterOf(a.lastAt, new Date(r.updatedAt).toISOString());
  }

  // 2) Favoris, likes hors bibliothèque, Ma liste.
  for (const item of input.favorites) {
    const a = touchItem(item);
    if (!a) continue;
    a.weight += ANCHOR_FAVORITE;
    a.kinds.add("favorite");
  }
  for (const like of input.likes) {
    const mediaType = canonicalType(like.mediaType);
    const a = touch(`${mediaType}:${like.tmdbId}`, mediaType, like.tmdbId, "");
    a.weight += ANCHOR_LIKE * explicitDecay(ageOf(like.createdAt));
    a.kinds.add("like");
  }
  for (const item of input.watchlist) {
    const a = touchItem(item);
    if (!a) continue;
    a.weight += ANCHOR_WATCHLIST;
    a.kinds.add("watchlist");
  }

  // 2 bis) Verdicts du swipe : explicites, donc à décroissance lente.
  for (const sw of input.swipes ?? []) {
    const base = swipeAnchorWeight(sw.verdict);
    if (base === 0) continue;
    const mediaType = canonicalType(sw.mediaType);
    const a = touch(`${mediaType}:${sw.tmdbId}`, mediaType, sw.tmdbId, "");
    a.weight += base * explicitDecay(ageOf(sw.updatedAt));
    a.kinds.add(base < 0 ? "swipe_dislike" : sw.verdict === "superlike" ? "superlike" : "swipe_like");
    if (base > 0) a.lastAt = laterOf(a.lastAt, new Date(sw.updatedAt).toISOString());
  }

  // 3) Films vus, et revus quand c'est vérifié.
  const playedIds = new Set<string>();
  for (const item of input.playedMovies) {
    const a = touchItem(item);
    if (!a) continue;
    playedIds.add(item.Id);
    const date = item.UserData?.LastPlayedDate ?? null;
    const decay = implicitDecay(playAgeDays(date, bulk, now));
    a.weight += ANCHOR_COMPLETED * decay;
    a.kinds.add("completed");
    a.consumption = true;
    a.hours = Math.max(a.hours, (item.RunTimeTicks ?? 0) / TICKS_PER_HOUR);
    if (playAgeDays(date, bulk, now) < 365 && date) a.lastAt = laterOf(a.lastAt, date);
    const verified = (input.measured?.get(item.Id)?.fullDays ?? 0) >= 2;
    const counted = (item.UserData?.PlayCount ?? 0) >= 2;
    if (verified || counted) {
      a.weight += (verified ? ANCHOR_REWATCH : ANCHOR_REWATCH_UNVERIFIED) * decay;
      a.kinds.add("rewatch");
    }
  }

  // 4) Séries suivies : heures regardées, dernier épisode daté.
  const bySeries = new Map<string, { hours: number; episodes: number; last: string | null }>();
  for (const ep of input.playedEpisodes) {
    if (!ep.SeriesId) continue;
    const s = bySeries.get(ep.SeriesId) ?? { hours: 0, episodes: 0, last: null };
    const ticks = ep.RunTimeTicks ?? 0;
    s.hours += ticks > 0 ? ticks / TICKS_PER_HOUR : EPISODE_FALLBACK_HOURS;
    s.episodes++;
    const date = ep.UserData?.LastPlayedDate ?? null;
    // Le plus récent épisode vraiment regardé date la série ; un marquage en
    // masse ne compte que faute de mieux.
    if (date && playAgeDays(date, bulk, now) < 365) s.last = laterOf(s.last, date);
    bySeries.set(ep.SeriesId, s);
  }
  for (const [seriesId, s] of bySeries) {
    const weight = seriesEngagementByHours(s.hours, s.episodes);
    const series = input.seriesById.get(seriesId);
    if (weight <= 0 || !series) continue;
    const a = touchItem(series);
    if (!a) continue;
    a.weight += weight * implicitDecay(playAgeDays(s.last, bulk, now));
    a.kinds.add("series");
    a.consumption = true;
    a.hours = Math.max(a.hours, s.hours);
    a.lastAt = laterOf(a.lastAt, s.last);
  }

  // 5) Abandons : < 25 % d'un film jamais terminé, ou une série lâchée tôt
  //    (un épisode en plan après cinquante vus n'est pas un abandon).
  for (const item of input.resumable) {
    const runtime = item.RunTimeTicks ?? 0;
    const last = item.UserData?.LastPlayedDate;
    if (runtime <= 0 || !last || playedIds.has(item.Id)) continue;
    const progress = (item.UserData?.PlaybackPositionTicks ?? 0) / runtime;
    const idle = ageOf(last);
    if (progress >= ABANDON_MAX_PROGRESS || idle < ABANDON_MIN_IDLE_DAYS) continue;
    let target: SignalItem | null = item;
    if (item.Type === "Episode") {
      if (!item.SeriesId || (bySeries.get(item.SeriesId)?.episodes ?? 0) >= SERIES_MIN_EPISODES) continue;
      target = input.seriesById.get(item.SeriesId) ?? null;
    }
    const a = target ? touchItem(target) : null;
    if (!a) continue;
    a.weight += ANCHOR_ABANDON * implicitDecay(idle);
    a.kinds.add("abandon");
  }

  // 6) Refus explicites (« ne plus me proposer »).
  for (const f of input.feedback) {
    const base = f.action === "not_interested" ? ANCHOR_NOT_INTERESTED : f.action === "dismissed" ? ANCHOR_DISMISSED : 0;
    const m = /^(movie|tv):(\d+)$/.exec(f.itemKey);
    if (base === 0 || !m) continue;
    const mediaType = m[1] as "movie" | "tv";
    const a = touch(f.itemKey, mediaType, Number(m[2]), "");
    a.weight += base * explicitDecay(ageOf(f.createdAt));
    a.kinds.add("dismissed");
  }

  const anchors: Anchor[] = [];
  for (const a of acc.values()) {
    const rating = a.ratingWeights.length
      ? a.ratingWeights.reduce((s, w) => s + w, 0) / a.ratingWeights.length
      : 0;
    const weight = Math.min(ANCHOR_MAX, Math.max(ANCHOR_MIN, a.weight + rating));
    if (Math.abs(weight) < ANCHOR_EPSILON) continue;
    anchors.push({
      key: a.key,
      mediaType: a.mediaType,
      tmdbId: a.tmdbId,
      title: a.title,
      weight,
      consumption: a.consumption,
      hours: Math.round(a.hours * 10) / 10,
      lastAt: a.lastAt,
      kinds: [...a.kinds],
    });
  }
  anchors.sort((x, y) => Math.abs(y.weight) - Math.abs(x.weight) || (x.key < y.key ? -1 : 1));
  return { anchors, itemByKey };
}
