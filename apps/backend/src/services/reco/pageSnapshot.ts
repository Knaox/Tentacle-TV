import { getPrisma } from "../db";
import { GLOBAL_CACHE_USER_ID } from "../globalCacheStore";
import type { RecoState } from "./serveContext";
import type { RecoRowItem } from "./rowItem";
import { SERVER_PULSE_ROW_KEY } from "./serverPulse";
import { TRENDING_ROW_KEY } from "./trendingRow";

/**
 * La page de recommandations MATÉRIALISÉE : par compte et par filtre de
 * plateformes, dans recommendation_cache sous `page:<filterKey>` — les
 * rangées AVEC leurs items, prêtes à servir. Construite en fond, jamais
 * dans une requête ; servie telle quelle même périmée pendant qu'une
 * reconstruction repart (stale-while-revalidate).
 *
 * `expiresAt` = dernier SERVICE + sept jours : la purge horaire fauche les
 * snapshots que personne ne demande plus, l'éviction garde les plus
 * récemment servis, et « comptes actifs » se lit sur `page:all` vivants.
 */
export const SNAPSHOT_VERSION = 1;
export const SNAPSHOT_KEY_PREFIX = "page:";
export const SNAPSHOT_TTL_MS = 7 * 24 * 3600_000;
/** Snapshots FILTRÉS gardés par compte (« all » vit toujours). */
export const FILTERED_SNAPSHOTS_MAX = 4;
/** Le service repousse `expiresAt` au plus une fois par heure. */
const TOUCH_THROTTLE_MS = 3600_000;
const GLOBALS_STAMP_MEMO_MS = 60_000;

export interface SnapshotRow {
  key: string;
  seedTitle?: string;
  items: RecoRowItem[];
}

export interface PageSnapshot {
  version: number;
  builtAt: string;
  /** Jour UTC du tirage quotidien (rangées « Parce que… » / « Avec… »). */
  dayKey: string;
  state: RecoState;
  /** Le `generatedAt` DISQUE du pool qui a servi — une régénération le change. */
  poolGeneratedAt: string | null;
  poolPreliminary: boolean;
  profileComputedAt: string | null;
  settingsUpdatedAt: string | null;
  globalsGeneratedAt: string | null;
  filter: { providers: number[] } | null;
  rows: SnapshotRow[];
}

export function snapshotRowKey(filterKey: string): string {
  const rowKey = SNAPSHOT_KEY_PREFIX + filterKey;
  if (rowKey.length > 64) throw new Error(`clé de snapshot trop longue : ${rowKey}`);
  return rowKey;
}

export function filterKeyOfRowKey(rowKey: string): string | null {
  return rowKey.startsWith(SNAPSHOT_KEY_PREFIX) ? rowKey.slice(SNAPSHOT_KEY_PREFIX.length) : null;
}

/** Lu SANS regarder `expiresAt` (la purge fauche) ; version ≠ ou illisible → null. */
export async function readSnapshot(userId: string, filterKey: string): Promise<PageSnapshot | null> {
  const prisma = getPrisma();
  const row = await prisma.recommendationCache.findUnique({
    where: { jellyfinUserId_rowKey: { jellyfinUserId: userId, rowKey: snapshotRowKey(filterKey) } },
  });
  if (!row) return null;
  try {
    const snapshot = JSON.parse(row.payload) as PageSnapshot;
    return snapshot.version === SNAPSHOT_VERSION && Array.isArray(snapshot.rows) ? snapshot : null;
  } catch {
    return null;
  }
}

/** Création : `expiresAt` = +7 j ; remplacement : payload et `generatedAt`
 *  seulement — `expiresAt` reste la trace du dernier SERVICE. */
export async function writeSnapshot(userId: string, filterKey: string, snapshot: PageSnapshot): Promise<void> {
  const prisma = getPrisma();
  const rowKey = snapshotRowKey(filterKey);
  const payload = JSON.stringify(snapshot);
  await prisma.recommendationCache.upsert({
    where: { jellyfinUserId_rowKey: { jellyfinUserId: userId, rowKey } },
    create: { jellyfinUserId: userId, rowKey, payload, expiresAt: new Date(Date.now() + SNAPSHOT_TTL_MS) },
    update: { payload, generatedAt: new Date() },
  });
}

const lastTouch = new Map<string, number>();

/** Au service : repousse la durée de vie, au plus une fois par heure, sans attendre. */
export function touchSnapshot(userId: string, filterKey: string, now = Date.now()): void {
  const key = `${userId}|${filterKey}`;
  const last = lastTouch.get(key) ?? 0;
  if (now - last < TOUCH_THROTTLE_MS) return;
  lastTouch.set(key, now);
  const prisma = getPrisma();
  void prisma.recommendationCache
    .updateMany({
      where: { jellyfinUserId: userId, rowKey: snapshotRowKey(filterKey) },
      data: { expiresAt: new Date(now + SNAPSHOT_TTL_MS) },
    })
    .catch(() => undefined);
}

export async function listSnapshots(userId: string): Promise<Array<{ filterKey: string; expiresAt: Date }>> {
  const prisma = getPrisma();
  const rows = await prisma.recommendationCache.findMany({
    where: { jellyfinUserId: userId, rowKey: { startsWith: SNAPSHOT_KEY_PREFIX } },
    select: { rowKey: true, expiresAt: true },
  });
  return rows.flatMap((r) => {
    const filterKey = filterKeyOfRowKey(r.rowKey);
    return filterKey ? [{ filterKey, expiresAt: r.expiresAt }] : [];
  });
}

/** Les clés de filtre encore vivantes du compte, « all » en tête puis les
 *  plus récemment servies — ce que la reconstruction en fond reconstruit. */
export async function listLiveFilterKeys(userId: string, now = new Date()): Promise<string[]> {
  const live = (await listSnapshots(userId)).filter((s) => s.expiresAt > now);
  live.sort((a, b) => Number(b.filterKey === "all") - Number(a.filterKey === "all") || b.expiresAt.getTime() - a.expiresAt.getTime());
  return live.map((s) => s.filterKey);
}

/** Les comptes dont la page « all » a été servie dans la semaine, les plus récents d'abord. */
export async function listActiveAccounts(now = new Date()): Promise<string[]> {
  const prisma = getPrisma();
  const rows = await prisma.recommendationCache.findMany({
    where: { rowKey: snapshotRowKey("all"), expiresAt: { gt: now } },
    select: { jellyfinUserId: true },
    orderBy: { expiresAt: "desc" },
  });
  return rows.map((r) => r.jellyfinUserId).filter((id) => id !== GLOBAL_CACHE_USER_ID);
}

export async function deleteSnapshots(userId: string): Promise<number> {
  const prisma = getPrisma();
  const res = await prisma.recommendationCache.deleteMany({
    where: { jellyfinUserId: userId, rowKey: { startsWith: SNAPSHOT_KEY_PREFIX } },
  });
  return res.count;
}

/** Pur : garde « all » et les `keepFiltered` snapshots filtrés les plus
 *  récemment servis ; rend les clés à évincer (égalités tranchées par clé). */
export function pickSnapshotsToEvict(
  entries: ReadonlyArray<{ filterKey: string; expiresAt: Date }>,
  keepFiltered = FILTERED_SNAPSHOTS_MAX
): string[] {
  const filtered = entries
    .filter((e) => e.filterKey !== "all")
    .sort((a, b) => b.expiresAt.getTime() - a.expiresAt.getTime() || (a.filterKey < b.filterKey ? -1 : 1));
  return filtered.slice(keepFiltered).map((e) => e.filterKey);
}

export async function evictSnapshots(userId: string): Promise<number> {
  const victims = pickSnapshotsToEvict(await listSnapshots(userId));
  if (victims.length === 0) return 0;
  const prisma = getPrisma();
  const res = await prisma.recommendationCache.deleteMany({
    where: { jellyfinUserId: userId, rowKey: { in: victims.map(snapshotRowKey) } },
  });
  return res.count;
}

let globalsStamp: { at: number; value: string | null } | null = null;

/** La date des sentinelles GLOBALES (tendances, pouls) — les rangées servies
 *  à tous ; l'annuaire des plateformes n'y compte pas. Mémo une minute. */
export async function readGlobalsStamp(): Promise<string | null> {
  if (globalsStamp && Date.now() - globalsStamp.at < GLOBALS_STAMP_MEMO_MS) return globalsStamp.value;
  const prisma = getPrisma();
  const rows = await prisma.recommendationCache.findMany({
    where: { jellyfinUserId: GLOBAL_CACHE_USER_ID, rowKey: { in: [TRENDING_ROW_KEY, SERVER_PULSE_ROW_KEY] } },
    select: { generatedAt: true },
  });
  let max: Date | null = null;
  for (const r of rows) if (!max || r.generatedAt > max) max = r.generatedAt;
  const value = max ? max.toISOString() : null;
  globalsStamp = { at: Date.now(), value };
  return value;
}

/** Isolation des tests. */
export function resetPageSnapshotForTests(): void {
  lastTouch.clear();
  globalsStamp = null;
}
