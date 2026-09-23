/**
 * Ce que la recherche demande encore à Jellyfin lui-même, au nom du compte.
 *
 * - Les ÉPISODES : des dizaines de milliers dans une bibliothèque moyenne —
 *   les indexer coûterait plus que les chercher. `searchTerm` au nom du compte
 *   (clé admin + `userId` : les droits sont ceux de Jellyfin), servi par une
 *   requête À PART que le client attend sans bloquer le reste.
 * - Le REPLI : tant que l'index du serveur se construit (premier démarrage),
 *   films, séries et collections viennent de `searchTerm` aussi.
 *
 * `searchTerm` prend la ponctuation au pied de la lettre (voir l'en-tête de
 * `textSearch.ts`) : sans résultat, on réessaie avec le mot le plus long,
 * puis on reclasse localement — la recette de `useSearchItems`.
 */

import type { SearchMediaItem } from "../../search/searchTypes";
import { fallbackTerm, searchScore } from "../../utils/textSearch";
import { getJellyfinApiKey, getJellyfinUrl } from "../configStore";

const TIMEOUT_MS = 8_000;

const EPISODE_FIELDS = "PrimaryImageAspectRatio,SeriesPrimaryImageTag,ParentBackdropImageTags,RunTimeTicks";
const ITEM_FIELDS = "PrimaryImageAspectRatio,Genres,OriginalTitle,ChildCount";

async function searchTermQuery(
  userId: string,
  term: string,
  types: string,
  fields: string,
  limit: number,
): Promise<SearchMediaItem[]> {
  const url = getJellyfinUrl();
  const apiKey = getJellyfinApiKey();
  if (!url || !apiKey) return [];
  const res = await fetch(
    `${url}/Items?userId=${encodeURIComponent(userId)}&searchTerm=${encodeURIComponent(term)}` +
      `&IncludeItemTypes=${types}&Recursive=true&Limit=${limit}&Fields=${fields}` +
      `&EnableImageTypes=Primary,Thumb,Backdrop&ImageTypeLimit=1&EnableUserData=true`,
    { headers: { "X-Emby-Token": apiKey }, signal: AbortSignal.timeout(TIMEOUT_MS) },
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { Items?: SearchMediaItem[] };
  return data.Items ?? [];
}

/** Tel quel, puis par le mot le plus long, reclassé — jamais un résultat sans rapport. */
async function searchWithFallback(
  userId: string,
  raw: string,
  types: string,
  fields: string,
  limit: number,
): Promise<SearchMediaItem[]> {
  const direct = await searchTermQuery(userId, raw, types, fields, limit);
  if (direct.length > 0) return direct;
  const wider = fallbackTerm(raw);
  if (wider === null) return [];
  const loose = await searchTermQuery(userId, wider, types, fields, limit * 2);
  return loose
    .map((item) => ({ item, score: searchScore(item.Name, raw) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.item);
}

export function searchEpisodes(userId: string, raw: string, limit: number): Promise<SearchMediaItem[]> {
  return searchWithFallback(userId, raw, "Episode", EPISODE_FIELDS, limit);
}

export function fallbackItems(userId: string, raw: string, limit: number): Promise<SearchMediaItem[]> {
  return searchWithFallback(userId, raw, "Movie,Series,BoxSet", ITEM_FIELDS, limit);
}
