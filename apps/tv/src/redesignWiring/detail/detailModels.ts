import {
  extractMediaQuality,
  formatCommunityRating,
  formatDuration,
  formatEpisodeCode,
  type MediaItem,
  type NextEpisodeResult,
} from "@tentacle-tv/shared";
import type { MetaItem } from "../../redesign/hero/MetaLine";
import type { DetailHeaderModel, DetailKind, DetailPlayModel } from "../../redesign/screens/detail/detailTypes";

/**
 * L'en-tête et la lecture de la fiche refondue, tirés de l'item Jellyfin par
 * les fonctions partagées — les mêmes règles que le banc
 * (`harness/ui-bench/data/detailModels.ts`), qui les a dessinées sur les vraies
 * données du compte de test. Pur : aucune requête, aucun état.
 */

export type Translate = (key: string, options?: Record<string, unknown>) => string;

const TICKS_PER_MINUTE = 60 * 10_000_000;

/** Les résumés Jellyfin portent parfois du HTML (« <br>Source: crunchyroll »). */
export function plainText(value: string | null | undefined): string | undefined {
  const text = value?.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  return text || undefined;
}

export function detailKindOf(item: MediaItem): DetailKind {
  if (item.Type === "Series") return "series";
  if (item.Type === "Episode") return "episode";
  if (item.Type === "BoxSet") return "collection";
  return "movie";
}

/** 0 à 1, ou `undefined` quand il n'y a rien à reprendre (titre vu, jamais commencé). */
export function progressOf(item: MediaItem): number | undefined {
  const pct = item.UserData?.PlayedPercentage ?? 0;
  return item.UserData?.Played || pct <= 0 ? undefined : pct / 100;
}

/** « Reste 12 min », « Reste 2 h 07 min » — sous la pilule « Reprendre ». */
export function remainingOf(item: MediaItem, t: Translate): string | undefined {
  const pct = item.UserData?.PlayedPercentage ?? 0;
  if (!item.RunTimeTicks || pct <= 0) return undefined;
  const minutes = Math.max(1, Math.round((item.RunTimeTicks * (1 - pct / 100)) / TICKS_PER_MINUTE));
  if (minutes < 60) return t("media:detailRemainingMinutes", { count: minutes });
  return t("media:detailRemainingHours", { hours: Math.floor(minutes / 60), minutes: String(minutes % 60).padStart(2, "0") });
}

/** « 2005 · CH-16 · 2h 08min · Drame, Romance · ★ 8.1 » — les faits, sans la technique. */
export function factsOf(item: MediaItem, t: Translate): MetaItem[] {
  const meta: MetaItem[] = [];
  if (item.ProductionYear) meta.push(String(item.ProductionYear));
  if (item.OfficialRating) meta.push({ badge: item.OfficialRating });
  if (item.Type === "Series") {
    const seasons = item.ChildCount ?? 0;
    if (seasons > 0) meta.push(t("common:seasonsCount", { count: seasons }));
  } else {
    const duration = formatDuration(item.RunTimeTicks);
    if (duration) meta.push(duration);
  }
  const genres = (item.Genres ?? []).slice(0, 2);
  if (genres.length && item.Type !== "Episode") meta.push(genres.join(", "));
  if (item.CommunityRating) meta.push({ rating: formatCommunityRating(item.CommunityRating) });
  return meta;
}

/** « 4K · Dolby Vision · Atmos · VF · EN » — des pastilles de texte, jamais des drapeaux. */
export function badgesOf(item: MediaItem): MetaItem[] {
  const q = extractMediaQuality(item);
  const badges: MetaItem[] = [];
  if (q.resolution === "4K") badges.push({ badge: "4K", strong: true });
  if (q.isDolbyVision) badges.push({ badge: "Dolby Vision" });
  else if (q.isHDR) badges.push({ badge: "HDR" });
  if (q.isDolbyAtmos) badges.push({ badge: "Atmos" });
  else if (q.surroundLabel) badges.push({ badge: q.surroundLabel });
  for (const label of q.audioLabels.slice(0, 3)) badges.push({ badge: label.token });
  return badges;
}

export interface HeaderInput {
  item: MediaItem;
  logoUri?: string;
  /** La note perso du compte, 1 à 10 ; `null` : pas notée. */
  userScore: number | null;
  /** Collection : le nombre de ses titres (son contenu, sinon `ChildCount`). */
  collectionCount?: number;
  t: Translate;
  locale: string;
}

export function headerModelOf({ item, logoUri, userScore, collectionCount, t, locale }: HeaderInput): DetailHeaderModel {
  const synopsis = plainText(item.Overview);
  if (item.Type === "Episode") {
    const aired = item.PremiereDate
      ? new Date(item.PremiereDate).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" })
      : null;
    return {
      kind: "episode",
      title: item.Name ?? "",
      logoUri,
      seriesLink: `${item.SeriesName ?? ""} — ${formatEpisodeCode(item.ParentIndexNumber, item.IndexNumber)}`,
      // La date de diffusion tient lieu d'année.
      meta: [...(aired ? [aired] : []), ...factsOf(item, t).filter((m) => typeof m !== "string" || !/^\d{4}$/.test(m))],
      badges: badgesOf(item),
      userScore,
      synopsis,
    };
  }
  if (item.Type === "BoxSet") {
    const count = collectionCount ?? item.ChildCount ?? 0;
    const rating = item.CommunityRating ? [{ rating: formatCommunityRating(item.CommunityRating) }] : [];
    return {
      kind: "collection",
      title: item.Name ?? "",
      logoUri,
      meta: [...(count > 0 ? [t("media:collectionTitles", { count })] : []), ...rating],
      badges: [],
      userScore,
      synopsis,
    };
  }
  return {
    kind: detailKindOf(item),
    title: item.Name ?? "",
    logoUri,
    meta: factsOf(item, t),
    badges: badgesOf(item),
    userScore,
    synopsis,
  };
}

/**
 * La pilule de lecture : « Reprendre » (jauge et reste) ou « Lecture » ; pour
 * une série, l'épisode résolu par `useSeriesWatchState` — « Reprendre S2 · E5 »,
 * « Lecture S1 · E1 » — et rien pour une série terminée (pas de pilule, comme
 * le bureau). `watch` absent : l'état se résout encore, « Lecture » attend.
 * Une collection ne se lit pas.
 */
export function playModelOf(item: MediaItem, watch: NextEpisodeResult | undefined, t: Translate): DetailPlayModel | null {
  if (item.Type === "BoxSet") return null;
  if (item.Type === "Series") {
    if (!watch) return { label: t("common:play") };
    if (watch.type === "completed") return null;
    const episode = watch.episode;
    const code = formatEpisodeCode(episode.ParentIndexNumber, episode.IndexNumber);
    if (watch.type !== "continue") return { label: `${t("common:play")} ${code}` };
    return { label: `${t("common:resume")} ${code}`, progress: progressOf(episode), caption: remainingOf(episode, t) };
  }
  const progress = progressOf(item);
  if (progress === undefined) return { label: t("common:play") };
  return { label: t("common:resume"), progress, caption: remainingOf(item, t) };
}
