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
  bulkMinutes,
  explicitDecay,
  implicitDecay,
  playAgeDays,
  seriesEngagementByHours,
  swipeAnchorWeight,
} from "./anchorSignals";
import { ratingSignalWeight, ratingStats } from "./profileMath";
import type { SignalItem } from "./signals";
import type { Anchor, AnchorInputs, AnchorKind, AnchorSet } from "./anchorTypes";
import { abandonsOf, availableEpisodes, classifyResume, isEarlyDrop, seriesViewings } from "./viewingSignals";

export type { Anchor, AnchorInputs, AnchorKind, AnchorSet, MeasuredViewing, PlayedEpisode } from "./anchorTypes";

const TICKS_PER_HOUR = 36_000_000_000;
/** Plancher de pertinence : en deçà, une ancre ne dit rien. */
const ANCHOR_EPSILON = 0.02;

interface Acc extends Omit<Anchor, "kinds"> {
  kinds: Set<AnchorKind>;
  ratingWeights: number[];
  /** Les « j'aime » du titre, par toutes leurs voies : seul le plus fort compte. */
  likeWeights: number[];
}

function canonicalType(mediaType: string): "movie" | "tv" {
  return mediaType === "movie" ? "movie" : "tv";
}

/** La clé canonique d'un item Jellyfin (film ou série) — celle des ancres et des potentiels. */
export function refOf(item: SignalItem): { key: string; mediaType: "movie" | "tv"; tmdbId: number } | null {
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
      a = { key, mediaType, tmdbId, title, weight: 0, consumption: false, hours: 0, lastAt: null, kinds: new Set(), ratingWeights: [], likeWeights: [] };
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

  // 2) Favoris, likes hors bibliothèque. Un « j'aime » est UN goût, quelle
  //    que soit sa voie (cf. likeWeights). Ma liste n'en est pas un : ce
  //    qu'on n'a ni vu ni aimé n'est pas encore jugé (cf. potentials.ts).
  for (const item of input.favorites) {
    const a = touchItem(item);
    if (!a) continue;
    a.likeWeights.push(ANCHOR_FAVORITE);
    a.kinds.add("favorite");
  }
  for (const like of input.likes) {
    const mediaType = canonicalType(like.mediaType);
    const a = touch(`${mediaType}:${like.tmdbId}`, mediaType, like.tmdbId, "");
    a.likeWeights.push(ANCHOR_LIKE * explicitDecay(ageOf(like.createdAt)));
    a.kinds.add("like");
  }

  // 2 bis) Verdicts du swipe : explicites, donc à décroissance lente.
  for (const sw of input.swipes ?? []) {
    const base = swipeAnchorWeight(sw.verdict);
    if (base === 0) continue;
    const mediaType = canonicalType(sw.mediaType);
    const a = touch(`${mediaType}:${sw.tmdbId}`, mediaType, sw.tmdbId, "");
    // Un like d'Affiner POSE le cœur (swipeFavorites) : c'est le même goût.
    if (base > 0) a.likeWeights.push(base * explicitDecay(ageOf(sw.updatedAt)));
    else a.weight += base * explicitDecay(ageOf(sw.updatedAt));
    a.kinds.add(base < 0 ? "swipe_dislike" : sw.verdict === "superlike" ? "superlike" : "swipe_like");
    if (base > 0) a.lastAt = laterOf(a.lastAt, new Date(sw.updatedAt).toISOString());
  }

  // 3) Films vus, et revus quand c'est vérifié — arrêtés au générique (≥ 80 %)
  //    compris : Jellyfin ne marque « vu » qu'à 92 %.
  const playedIds = new Set<string>();
  const completedKeys = new Set<string>();
  const resumedMovies = input.resumable.filter((m) => m.Type === "Movie" && classifyResume(m).kind === "watched");
  for (const item of [...input.playedMovies, ...resumedMovies]) {
    const ref = refOf(item);
    // Deux versions d'un même film ne font qu'un visionnage.
    if (!ref || completedKeys.has(ref.key)) continue;
    const a = touchItem(item);
    if (!a) continue;
    completedKeys.add(ref.key);
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

  // 3 bis) Films vus en PARTIE (25-80 %) : une part du « vu », au prorata.
  for (const item of input.resumable) {
    const verdict = classifyResume(item);
    const ref = item.Type === "Movie" ? refOf(item) : null;
    if (verdict.kind !== "partial" || !ref || completedKeys.has(ref.key)) continue;
    const a = touchItem(item)!;
    const date = item.UserData?.LastPlayedDate ?? null;
    a.weight += ANCHOR_COMPLETED * verdict.progress * implicitDecay(playAgeDays(date, bulk, now));
    a.kinds.add("partial");
    a.consumption = true;
    a.hours = Math.max(a.hours, ((item.RunTimeTicks ?? 0) / TICKS_PER_HOUR) * verdict.progress);
    if (date) a.lastAt = laterOf(a.lastAt, date);
  }

  // 4) Séries suivies : heures regardées (entamés compris), dernier épisode
  //    daté. Une série longue lâchée tôt reste TIÈDE : jugée, sans poids.
  const bySeries = seriesViewings(input.playedEpisodes, input.resumable, bulk, now);
  for (const [seriesId, s] of bySeries) {
    const series = input.seriesById.get(seriesId);
    if (!series) continue;
    if (isEarlyDrop(s, availableEpisodes(series), now)) {
      touchItem(series);
      continue;
    }
    const weight = seriesEngagementByHours(s.hours, s.episodes);
    if (weight <= 0) continue;
    const a = touchItem(series);
    if (!a) continue;
    a.weight += weight * implicitDecay(playAgeDays(s.last, bulk, now));
    a.kinds.add("series");
    a.consumption = true;
    a.hours = Math.max(a.hours, s.hours);
    a.lastAt = laterOf(a.lastAt, s.last);
  }

  // 5) Abandons, UN par titre : un vrai départ (≥ 5 min ou 5 %) sous 25 %,
  //    laissé un mois, et rien vu de la série depuis.
  for (const { target, idleDays } of abandonsOf({ resumable: input.resumable, playedMovieIds: playedIds, series: bySeries, seriesById: input.seriesById, now })) {
    const ref = refOf(target);
    if (!ref || completedKeys.has(ref.key)) continue;
    const a = touchItem(target);
    if (!a || a.kinds.has("abandon") || a.kinds.has("partial")) continue;
    a.weight += ANCHOR_ABANDON * implicitDecay(idleDays);
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
    // Un même « j'aime » dit par plusieurs voies — le cœur, un like Vigie, un
    // like ou un coup de cœur d'Affiner — ne compte qu'une fois : le plus fort.
    const liked = a.likeWeights.length ? Math.max(...a.likeWeights) : 0;
    const weight = Math.min(ANCHOR_MAX, Math.max(ANCHOR_MIN, a.weight + liked + rating));
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
  return { anchors, itemByKey, judged: new Set(acc.keys()) };
}
