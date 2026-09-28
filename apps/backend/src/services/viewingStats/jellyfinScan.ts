import { getJellyfinApiKey, getJellyfinUrl } from "../configStore";

/**
 * Les lectures Jellyfin des statistiques : toujours la clé d'administration
 * + `userId` (ce qui donne les `UserData` DE CE COMPTE), jamais le jeton
 * entrant — il peut être un jeton Tentacle d'appareil, inconnu de Jellyfin.
 */

/** Une page de 500 : au-delà, Jellyfin ralentit et la réponse grossit pour rien. */
export const PAGE = 500;
/** Garde-fou : 40 pages, soit 20 000 titres vus par compte. */
export const PAGES_MAX = 40;
const TIMEOUT_MS = 15_000;

export interface JellyfinItem {
  Id: string;
  Name?: string;
  Type?: string;
  SeriesId?: string;
  SeriesName?: string;
  RunTimeTicks?: number;
  ProductionYear?: number;
  Genres?: string[];
  ProviderIds?: Record<string, string>;
  ImageTags?: Record<string, string>;
  BackdropImageTags?: string[];
  UserData?: { PlayCount?: number; LastPlayedDate?: string };
}

export class JellyfinUnavailable extends Error {}

function connection(): { base: string; key: string } {
  const base = getJellyfinUrl();
  const key = getJellyfinApiKey();
  if (!base || !key) throw new JellyfinUnavailable("Jellyfin non configuré");
  return { base, key };
}

async function getJson<T>(path: string): Promise<T> {
  const { base, key } = connection();
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, { headers: { "X-Emby-Token": key }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) {
    throw new JellyfinUnavailable(err instanceof Error ? err.message : "réseau");
  }
  if (!res.ok) throw new JellyfinUnavailable(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

/**
 * Parcourt une liste paginée et remet chaque page à `onPage` : le pic mémoire
 * est celui d'UNE page, repliée par l'appelant puis abandonnée.
 */
export async function scanItems(
  userId: string,
  params: Record<string, string>,
  onPage: (items: JellyfinItem[]) => void
): Promise<void> {
  for (let page = 0, start = 0; page < PAGES_MAX; page++, start += PAGE) {
    const q = new URLSearchParams({
      userId,
      Recursive: "true",
      EnableImages: "false",
      EnableUserData: "true",
      EnableTotalRecordCount: "false",
      Limit: String(PAGE),
      StartIndex: String(start),
      ...params,
    });
    const data = await getJson<{ Items?: JellyfinItem[] }>(`/Items?${q}`);
    const items = data.Items ?? [];
    onPage(items);
    if (items.length < PAGE) return;
  }
}

/** Des titres par identifiants, par paquets de 100 (la longueur d'URL reste sage). */
export async function itemsByIds(userId: string, ids: string[], params: Record<string, string>): Promise<JellyfinItem[]> {
  const out: JellyfinItem[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const q = new URLSearchParams({ userId, Ids: ids.slice(i, i + 100).join(","), ...params });
    const data = await getJson<{ Items?: JellyfinItem[] }>(`/Items?${q}`);
    out.push(...(data.Items ?? []));
  }
  return out;
}

/** Le nombre de titres d'un filtre, sans en rapatrier un seul. */
export async function countItems(userId: string, params: Record<string, string>): Promise<number> {
  const q = new URLSearchParams({ userId, Recursive: "true", Limit: "0", EnableTotalRecordCount: "true", ...params });
  const data = await getJson<{ TotalRecordCount?: number }>(`/Items?${q}`);
  return data.TotalRecordCount ?? 0;
}

export function tmdbIdOf(item: Pick<JellyfinItem, "ProviderIds">): number | null {
  const raw = item.ProviderIds?.Tmdb ?? item.ProviderIds?.tmdb;
  const id = raw ? Number(raw) : NaN;
  return Number.isInteger(id) && id > 0 ? id : null;
}

export const TICKS_PER_SECOND = 10_000_000;
