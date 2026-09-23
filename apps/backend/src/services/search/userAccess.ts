/**
 * Ce que CHAQUE compte a le droit de trouver — et où il en est de chaque titre.
 *
 * Le catalogue est commun au serveur (`catalog.ts`) ; les droits, eux, sont
 * ceux de Jellyfin, appliqués par Jellyfin : un relevé des identifiants au nom
 * du compte (clé admin + `userId`, SANS liste d'`Ids` — avec une liste,
 * Jellyfin n'applique plus le filtre des bibliothèques autorisées), qui porte
 * au passage vu / en cours / favori. Rien d'autre n'est demandé : pas de
 * champ, pas d'image — quelques centaines d'octets par titre.
 *
 * Même mémoïsation que l'index de la reco (`libraryMemo.ts`) : servi tout de
 * suite, rafraîchi EN FOND au-delà de dix minutes, 10 s après un
 * `UserDataChanged` du compte, et à la demande après un `LibraryChanged`.
 * Jamais de balayage dans une requête, sauf la toute première du compte.
 */

import type { SearchUserData } from "../../search/searchTypes";
import { getJellyfinApiKey, getJellyfinUrl } from "../configStore";

export interface UserAccess {
  at: number;
  /** Titre → ses données de visionnage pour ce compte. Absent = invisible. */
  items: Map<string, SearchUserData>;
}

interface RawUserItem {
  Id: string;
  UserData?: Partial<SearchUserData>;
}

const PAGE = 2000;
const PAGES_MAX = 60;
const TIMEOUT_MS = 30_000;
const STALE_MS = 10 * 60_000;
const REFRESH_DEBOUNCE_MS = 10_000;
const SWEEP_AFTER_MS = 24 * 3600_000;

interface Entry { access: UserAccess; lastReadAt: number }

const memo = new Map<string, Entry>();
const pending = new Map<string, Promise<UserAccess | null>>();
const timers = new Map<string, NodeJS.Timeout>();

function toUserData(raw: Partial<SearchUserData> | undefined): SearchUserData {
  return {
    PlaybackPositionTicks: raw?.PlaybackPositionTicks ?? 0,
    PlayCount: raw?.PlayCount ?? 0,
    IsFavorite: raw?.IsFavorite === true,
    Played: raw?.Played === true,
    ...(raw?.PlayedPercentage != null ? { PlayedPercentage: raw.PlayedPercentage } : {}),
    ...(raw?.UnplayedItemCount != null ? { UnplayedItemCount: raw.UnplayedItemCount } : {}),
    ...(raw?.LastPlayedDate ? { LastPlayedDate: raw.LastPlayedDate } : {}),
  };
}

async function fetchUserAccess(userId: string): Promise<UserAccess | null> {
  const url = getJellyfinUrl();
  const apiKey = getJellyfinApiKey();
  if (!url || !apiKey) return null;
  const items = new Map<string, SearchUserData>();
  for (let page = 0; page < PAGES_MAX; page++) {
    const res = await fetch(
      `${url}/Items?userId=${encodeURIComponent(userId)}&Recursive=true&IncludeItemTypes=Movie,Series,BoxSet` +
        `&EnableImages=false&EnableUserData=true&StartIndex=${page * PAGE}&Limit=${PAGE}`,
      { headers: { "X-Emby-Token": apiKey }, signal: AbortSignal.timeout(TIMEOUT_MS) },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { Items?: RawUserItem[]; TotalRecordCount?: number };
    const batch = data.Items ?? [];
    for (const raw of batch) if (raw.Id) items.set(raw.Id, toUserData(raw.UserData));
    if (batch.length < PAGE) break;
    if (data.TotalRecordCount !== undefined && (page + 1) * PAGE >= data.TotalRecordCount) break;
  }
  return { at: Date.now(), items };
}

function refreshNow(userId: string): Promise<UserAccess | null> {
  const inFlight = pending.get(userId);
  if (inFlight) return inFlight;
  const run = fetchUserAccess(userId)
    .then((access) => {
      if (access === null) return memo.get(userId)?.access ?? null;
      memo.set(userId, { access, lastReadAt: memo.get(userId)?.lastReadAt ?? Date.now() });
      return access;
    })
    .catch((err: unknown) => {
      console.warn(`[search] droits du compte ${userId.slice(0, 8)}… non relevés — ${String(err)}`);
      return memo.get(userId)?.access ?? null;
    })
    .finally(() => pending.delete(userId));
  pending.set(userId, run);
  return run;
}

/** Les droits du compte : servis tout de suite, construits à la première recherche. */
export async function getUserAccess(userId: string): Promise<UserAccess | null> {
  const hit = memo.get(userId);
  if (hit) {
    hit.lastReadAt = Date.now();
    if (Date.now() - hit.access.at >= STALE_MS) void refreshNow(userId);
    return hit.access;
  }
  return refreshNow(userId);
}

/** Un vu, un favori, une reprise : rafraîchissement en fond, débouncé. */
export function refreshUserAccess(userId: string): void {
  if (!userId || !memo.has(userId)) return;
  const existing = timers.get(userId);
  if (existing) clearTimeout(existing);
  timers.set(userId, setTimeout(() => {
    timers.delete(userId);
    void refreshNow(userId);
  }, REFRESH_DEBOUNCE_MS));
}

/** La bibliothèque a changé : tous les comptes se rafraîchiront à leur prochaine recherche. */
export function markAllUserAccessStale(): void {
  for (const entry of memo.values()) entry.access.at = 0;
}

/** Retire les comptes que personne n'a lus depuis un jour. */
export function sweepUserAccess(now = Date.now()): number {
  let removed = 0;
  for (const [userId, entry] of memo) {
    if (now - entry.lastReadAt >= SWEEP_AFTER_MS && !timers.has(userId)) {
      memo.delete(userId);
      removed++;
    }
  }
  return removed;
}

export function resetUserAccessForTests(): void {
  memo.clear();
  pending.clear();
  for (const timer of timers.values()) clearTimeout(timer);
  timers.clear();
}
