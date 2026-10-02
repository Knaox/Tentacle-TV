/**
 * Les saisons d'une série, pour un client qui les choisit LUI-MÊME — pur, sans
 * React. Route facultative du contrat `titles` (cf. `pluginTitles.ts`, et
 * `pluginTitlesMeta.ts` côté serveur) :
 *
 *   GET seasons?key=tv:1399&lang=fr
 *     → { seasons: [{ number, name, episodeCount, badge, requestable }] }
 *       chaque saison, dans l'ordre où la proposer : où elle en est (les mots
 *       du plugin, comme les pastilles de `state`) et si elle se demande
 *       encore ; `{ ok: false, message }` quand le plugin ne peut pas le dire.
 *   POST request { mediaType: "tv", tmdbId, lang, seasons: [1, 2] }
 *     → la réponse habituelle du geste (`readTitleRequestOutcome`).
 *
 * Un plugin qui ne la déclare pas garde exactement le contrat d'avant : une
 * série s'y choisit dans SES pages (`request.mode: "open"`).
 */

import type { ExternalTone } from "./pluginSearch";
import { parseTitleKey, type TitleKey, type TitleProvider } from "./pluginTitles";

export interface TitleSeason {
  number: number;
  /** Le nom de la saison (« Saison 1 », « Épisodes spéciaux ») ; `null` : le client le dit. */
  name: string | null;
  episodeCount: number | null;
  /** Où elle en est (« Disponible », « Demandée ») ; `null` : libre. */
  badge: { label: string; tone: ExternalTone } | null;
  /** Elle se demande d'un geste. */
  requestable: boolean;
}

export interface TitleSeasonsAnswer {
  seasons: TitleSeason[];
  /** Le plugin ne peut pas le dire (sa source se tait) : sa phrase, ou `null`. */
  failure: string | null;
}

/** Au plus autant de saisons : au-delà, la feuille ne se lit plus. */
export const MAX_TITLE_SEASONS = 100;

const TONES: readonly ExternalTone[] = ["neutral", "info", "success", "warning"];

function text(value: unknown, max: number): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim().slice(0, max) : null;
}

/** Une série seulement : un film ne se demande pas par saisons. */
export function titleSeasonsUrl(provider: TitleProvider, key: TitleKey, lang: string): string | null {
  if (provider.seasonsPath === null || parseTitleKey(key)?.mediaType !== "tv") return null;
  const params = new URLSearchParams({ key, lang });
  return `/api/plugins/${encodeURIComponent(provider.pluginId)}${provider.seasonsPath}?${params.toString()}`;
}

/** Une saison, validée champ par champ ; illisible : `null`. Lue aussi par `pluginTitleGaps.ts`. */
export function readSeason(raw: unknown): TitleSeason | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const number = r.number;
  if (typeof number !== "number" || !Number.isInteger(number) || number < 0 || number >= 1000) return null;
  const b = r.badge && typeof r.badge === "object" ? r.badge as Record<string, unknown> : null;
  const label = b ? text(b.label, 40) : null;
  const count = r.episodeCount;
  return {
    number,
    name: text(r.name, 80),
    episodeCount: typeof count === "number" && Number.isInteger(count) && count >= 0 ? count : null,
    badge: label !== null
      ? { label, tone: TONES.includes(b?.tone as ExternalTone) ? (b?.tone as ExternalTone) : "neutral" }
      : null,
    requestable: r.requestable === true,
  };
}

/** La réponse, validée saison par saison : une saison illisible ou en double est écartée. */
export function readTitleSeasons(raw: unknown): TitleSeasonsAnswer {
  const r = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const seasons: TitleSeason[] = [];
  const seen = new Set<number>();
  for (const entry of Array.isArray(r.seasons) ? r.seasons : []) {
    const season = readSeason(entry);
    if (!season || seen.has(season.number)) continue;
    seen.add(season.number);
    seasons.push(season);
    if (seasons.length >= MAX_TITLE_SEASONS) break;
  }
  const failure = r.ok === false ? text(r.message, 200) ?? "" : null;
  return { seasons, failure };
}
