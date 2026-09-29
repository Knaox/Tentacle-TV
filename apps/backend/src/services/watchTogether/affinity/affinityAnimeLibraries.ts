import { getJellyfinApiKey, getJellyfinUrl } from "../../configStore";
import { isAnimeLibraryName } from "./affinityKinds";
import { jellyfinAuthHeaders } from "../../jellyfinAuth";

/**
 * Affinité — les titres rangés dans une bibliothèque d'ANIMÉS (nommée
 * « Animés », « Anime »…). Souvent le seul signe d'un animé : une
 * bibliothèque décrite par TMDB ne porte ni genre « Anime » ni id AniDB.
 *
 * Les vues du compte (`Users/{id}/Views`, clé admin — celles que le proxy
 * sert aux clients), puis les seuls ids de films et de séries de chacune des
 * bibliothèques retenues : ni image, ni données de lecture. Mémorisé dix
 * minutes par compte ; une panne rend l'ensemble vide (les deux autres signes
 * restent) et n'est pas retenue.
 */

const MEMO_MS = 10 * 60_000;
const PAGE = 1000;
const PAGES_MAX = 20;
const TIMEOUT_MS = 8000;

interface RawView {
  Id?: string;
  Name?: string;
}

const memo = new Map<string, { at: number; ids: Set<string> }>();

async function fetchJson<T>(url: string, apiKey: string): Promise<T | null> {
  const res = await fetch(url, { headers: jellyfinAuthHeaders(apiKey), signal: AbortSignal.timeout(TIMEOUT_MS) });
  return res.ok ? ((await res.json()) as T) : null;
}

async function itemIdsOf(base: string, apiKey: string, userId: string, parentId: string): Promise<string[]> {
  const ids: string[] = [];
  for (let page = 0; page < PAGES_MAX; page++) {
    const data = await fetchJson<{ Items?: Array<{ Id?: string }>; TotalRecordCount?: number }>(
      `${base}/Items?userId=${userId}&ParentId=${encodeURIComponent(parentId)}&Recursive=true` +
        `&IncludeItemTypes=Movie,Series&EnableImages=false&EnableUserData=false` +
        `&StartIndex=${page * PAGE}&Limit=${PAGE}`,
      apiKey,
    );
    const batch = data?.Items ?? [];
    for (const item of batch) if (item.Id) ids.push(item.Id);
    if (batch.length < PAGE || ids.length >= (data?.TotalRecordCount ?? 0)) break;
  }
  return ids;
}

export async function animeLibraryItemIds(userId: string): Promise<Set<string>> {
  const hit = memo.get(userId);
  if (hit && Date.now() - hit.at < MEMO_MS) return hit.ids;
  const base = getJellyfinUrl();
  const apiKey = getJellyfinApiKey();
  if (!base || !apiKey) return new Set();
  try {
    const views = await fetchJson<{ Items?: RawView[] }>(`${base}/Users/${userId}/Views`, apiKey);
    const animeViews = (views?.Items ?? []).filter((v) => v.Id && isAnimeLibraryName(v.Name ?? ""));
    const ids = new Set<string>();
    for (const view of animeViews) {
      for (const id of await itemIdsOf(base, apiKey, userId, view.Id!)) ids.add(id);
    }
    memo.set(userId, { at: Date.now(), ids });
    return ids;
  } catch {
    return new Set();
  }
}

/** Isolation des tests. */
export function resetAnimeLibrariesForTests(): void {
  memo.clear();
}
