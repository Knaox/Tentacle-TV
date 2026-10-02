/**
 * Les saisons qui manquent aux séries que la bibliothèque a EN PARTIE — pur,
 * sans React. Route facultative du contrat `titles` (cf. `pluginTitles.ts`, et
 * `pluginTitlesMeta.ts` côté serveur) :
 *
 *   GET gaps?keys=tv:1399,tv:1396&lang=fr
 *     → { items: { "tv:1399": { seasons: [{ number, name, episodeCount, badge, requestable }] } } }
 *       pour chaque série à qui il manque quelque chose : ses saisons
 *       absentes, dans la forme de `seasons` (`pluginTitleSeasons.ts`) — où
 *       elle en est, si elle se demande encore. Une série complète, ou dont
 *       le plugin ne sait rien, n'y figure pas.
 *
 * UNE question pour toute une page de résultats. Ce qui se demande et l'état
 * de chaque saison, c'est le plugin qui le dit : le client montre (« 2
 * saisons à demander ») et ouvre la feuille des saisons (`seasons`) au geste.
 * Un plugin qui ne déclare pas `gaps` garde exactement le contrat d'avant :
 * une série de la bibliothèque n'offre rien.
 */

import { parseTitleKey, titleKey, type TitleKey, type TitleProvider } from "./pluginTitles";
import { MAX_TITLE_SEASONS, readSeason, type TitleSeason } from "./pluginTitleSeasons";

/** Au plus autant de séries par question (longueur d'URL), comme `state`. */
export const TITLE_GAPS_BATCH = 60;

/** `null` : le plugin ne déclare pas la route. Des séries seulement. */
export function titleGapsUrl(provider: TitleProvider, keys: readonly TitleKey[], lang: string): string | null {
  const series = keys.filter((key) => parseTitleKey(key)?.mediaType === "tv");
  if (provider.gapsPath === null || series.length === 0) return null;
  const params = new URLSearchParams({ keys: series.join(","), lang });
  return `/api/plugins/${encodeURIComponent(provider.pluginId)}${provider.gapsPath}?${params.toString()}`;
}

/**
 * La réponse, validée série par série : seules les clés demandées comptent,
 * une saison illisible ou en double est écartée, une série sans saison lisible
 * n'a pas de trou.
 */
export function readTitleGaps(raw: unknown, keys: readonly TitleKey[]): Map<TitleKey, TitleSeason[]> {
  const out = new Map<TitleKey, TitleSeason[]>();
  const items = raw && typeof raw === "object" ? (raw as { items?: unknown }).items : null;
  if (!items || typeof items !== "object" || Array.isArray(items)) return out;
  for (const key of keys) {
    const entry = (items as Record<string, unknown>)[key];
    const list = entry && typeof entry === "object" ? (entry as { seasons?: unknown }).seasons : null;
    if (!Array.isArray(list)) continue;
    const seasons: TitleSeason[] = [];
    const seen = new Set<number>();
    for (const raw of list) {
      const season = readSeason(raw);
      if (!season || seen.has(season.number)) continue;
      seen.add(season.number);
      seasons.push(season);
      if (seasons.length >= MAX_TITLE_SEASONS) break;
    }
    if (seasons.length > 0) out.set(key, seasons);
  }
  return out;
}

/** Les saisons manquantes qui se demandent encore, dans leur ordre. */
export function requestableGaps(seasons: readonly TitleSeason[] | null | undefined): TitleSeason[] {
  return (seasons ?? []).filter((season) => season.requestable);
}

/**
 * La clé TMDB d'une SÉRIE de la bibliothèque — son `ProviderIds.Tmdb`, que
 * portent la fiche Jellyfin comme les résultats de `/api/search` —, ou `null`
 * (un film, une série sans identité TMDB, un serveur d'avant).
 */
export function seriesTitleKey(item: { Type?: string; ProviderIds?: Record<string, string> | null }): TitleKey | null {
  if (item.Type !== "Series") return null;
  const raw = item.ProviderIds?.Tmdb ?? item.ProviderIds?.tmdb;
  if (typeof raw !== "string" || !/^[1-9]\d{0,9}$/.test(raw)) return null;
  const tmdbId = Number(raw);
  return Number.isSafeInteger(tmdbId) ? titleKey("tv", tmdbId) : null;
}
