import { getPrisma } from "../db";
import { sendToUser } from "../wsManager";
import { prewarmLibraryMemo } from "./candidates/libraryMemo";
import { buildPageSnapshot, prepareBuildBase, yieldToLoop } from "./pageBuilder";
import type { PageBuildBase } from "./pageBuilder";
import { snapshotStaleReason } from "./pageRows";
import type { StalenessProbe } from "./pageRows";
import { msUntilNextUtcMidnight } from "./pageSchedule";
import { evictSnapshots, listActiveAccounts, listLiveFilterKeys, readSnapshot, writeSnapshot } from "./pageSnapshot";
import type { PageSnapshot } from "./pageSnapshot";
import { filterKeyOf, providerFilterFromQuery } from "./providerFilter";
import { onPoolWritten, onProfileRebuilt } from "./recoEvents";
import { serveContext } from "./serveContext";
import type { ServeContext } from "./serveContext";

/**
 * Les jobs de page : reconstruire les snapshots d'un compte EN FOND quand
 * quelque chose a changé (pool, profil, feedback, réglages, personnes,
 * plateformes apprises, jour UTC, rangées globales), puis prévenir le client
 * par WebSocket. Doctrine des jobs maison : timers au module, un couple
 * start/stop, un compte à la fois, jamais dans une requête.
 */
export type PageRebuildReason =
  | "pool"
  | "profile"
  | "feedback"
  | "settings"
  | "people"
  | "providers"
  | "day"
  | "globals"
  | "boot"
  | "miss"
  | "stale";

const POKE_DEBOUNCE_MS = 3_000;
const FANOUT_PAUSE_MS = 2_000;
const BOOT_DELAY_MS = 20_000;
const PREWARM_ACCOUNTS = 20;
/** Trente secondes après minuit : le jour est sûrement passé partout. */
const MIDNIGHT_MARGIN_MS = 30_000;

const pokeTimers = new Map<string, NodeJS.Timeout>();
const buildLocks = new Map<string, Promise<unknown>>();
const unsubscribe: Array<() => void> = [];
let running = false;
let midnightTimer: NodeJS.Timeout | null = null;
let bootTimer: NodeJS.Timeout | null = null;
let fanoutRunning = false;
let fanoutRerun: "globals" | "day" | "boot" | null = null;

/** Un seul travail de construction à la fois par compte, en file. */
function withBuildLock<T>(userId: string, work: () => Promise<T>): Promise<T> {
  const previous = buildLocks.get(userId) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(work);
  buildLocks.set(userId, next);
  return next.finally(() => {
    if (buildLocks.get(userId) === next) buildLocks.delete(userId);
  });
}

function providersOfFilterKey(filterKey: string): number[] | null {
  return filterKey === "all" ? null : providerFilterFromQuery(filterKey);
}

function probeOf(ctx: ServeContext, base: PageBuildBase): StalenessProbe {
  return {
    now: new Date(),
    state: ctx.state,
    poolGeneratedAt: base.poolStamp?.generatedAt.toISOString() ?? null,
    profileComputedAt: ctx.profileComputedAt,
    settingsUpdatedAt: ctx.settingsUpdatedAt,
    globalsGeneratedAt: base.globalsGeneratedAt,
  };
}

/** Le filtre SAUVEGARDÉ du compte (réglages reco) : sa page se précalcule
 *  toujours — c'est celle que l'utilisateur ouvre. */
async function savedFilterKey(userId: string): Promise<string | null> {
  const row = await getPrisma().recoSettings.findUnique({
    where: { jellyfinUserId: userId },
    select: { providerFilter: true },
  });
  if (!row?.providerFilter) return null;
  try {
    const ids = providerFilterFromQuery(JSON.parse(row.providerFilter));
    return ids ? filterKeyOf(ids) : null;
  } catch {
    return null;
  }
}

/** Les clés à tenir à jour pour un compte : « all » dès qu'un snapshot vit
 *  ou qu'un filtre est sauvegardé, le filtre sauvegardé, puis les filtres
 *  servis récemment. Rien de tout cela : le compte n'a jamais visité, sa
 *  première visite construira. */
async function filterKeysToMaintain(userId: string): Promise<string[]> {
  const [saved, live] = await Promise.all([savedFilterKey(userId), listLiveFilterKeys(userId)]);
  if (live.length === 0 && !saved) return [];
  const keys = ["all"];
  if (saved && saved !== "all") keys.push(saved);
  for (const key of live) if (!keys.includes(key)) keys.push(key);
  return keys;
}

/**
 * Reconstruit les snapshots d'un compte ; `onlyIfStale` ne réécrit que les
 * périmés (fan-outs idempotents). Un WebSocket `reco:update` part si quelque
 * chose a été réécrit.
 */
export async function rebuildPageSnapshots(
  userId: string,
  opts: { onlyIfStale?: boolean; reason?: PageRebuildReason } = {}
): Promise<{ built: string[] }> {
  return withBuildLock(userId, async () => {
    const keys = await filterKeysToMaintain(userId);
    if (keys.length === 0) return { built: [] };
    const started = Date.now();
    const ctx = await serveContext(userId);
    const base = await prepareBuildBase(userId, ctx);
    const built: string[] = [];
    for (const filterKey of keys) {
      if (opts.onlyIfStale) {
        const existing = await readSnapshot(userId, filterKey);
        if (existing && snapshotStaleReason(existing, probeOf(ctx, base)) === null) continue;
      }
      await writeSnapshot(userId, filterKey, await buildPageSnapshot(base, providersOfFilterKey(filterKey)));
      built.push(filterKey);
      await yieldToLoop();
    }
    if (built.length > 0) {
      console.log(
        `[Reco] Page ${userId.slice(0, 8)}… reconstruite (${built.join(", ")}) en ${Date.now() - started} ms (raison : ${opts.reason ?? "?"})`
      );
      sendToUser(userId, { type: "reco:update" });
    }
    return { built };
  });
}

/** Construction À LA VOLÉE d'un snapshot manquant (première visite, filtre
 *  jamais vu) — même file que la reconstruction en fond ; pas de push, le
 *  demandeur reçoit la réponse. */
export function buildSnapshotOnce(
  userId: string,
  ctx: ServeContext,
  filterKey: string,
  providers: number[] | null
): Promise<PageSnapshot> {
  return withBuildLock(userId, async () => {
    const base = await prepareBuildBase(userId, ctx);
    const snapshot = await buildPageSnapshot(base, providers);
    await writeSnapshot(userId, filterKey, snapshot);
    if (filterKey !== "all") await evictSnapshots(userId).catch(() => undefined);
    return snapshot;
  });
}

/** Demande débouncée (3 s) : une salve d'événements ne coûte qu'une reconstruction. */
export function pokePage(userId: string | null | undefined, reason: PageRebuildReason): void {
  if (!userId || !running) return;
  const existing = pokeTimers.get(userId);
  if (existing) clearTimeout(existing);
  pokeTimers.set(
    userId,
    setTimeout(() => {
      pokeTimers.delete(userId);
      rebuildPageSnapshots(userId, { reason }).catch((err) =>
        console.error(`[Reco] Page ${userId.slice(0, 8)}… : reconstruction en échec :`, err)
      );
    }, POKE_DEBOUNCE_MS)
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Tous les comptes actifs, un à la tour, seulement ce qui est périmé. */
export function fanoutPages(reason: "globals" | "day" | "boot"): void {
  if (!running) return;
  if (fanoutRunning) {
    fanoutRerun = reason;
    return;
  }
  fanoutRunning = true;
  void (async () => {
    try {
      const accounts = await listActiveAccounts();
      let rebuilt = 0;
      for (const userId of accounts) {
        if (!running) break;
        const { built } = await rebuildPageSnapshots(userId, { onlyIfStale: true, reason });
        if (built.length > 0) rebuilt++;
        await sleep(FANOUT_PAUSE_MS);
      }
      console.log(`[Reco] Pages (${reason}) : ${rebuilt} comptes reconstruits sur ${accounts.length} actifs`);
    } catch (err) {
      console.error(`[Reco] Pages (${reason}) : fan-out en échec :`, err);
    } finally {
      fanoutRunning = false;
      const again = fanoutRerun;
      fanoutRerun = null;
      if (again) fanoutPages(again);
    }
  })();
}

function scheduleMidnight(): void {
  if (midnightTimer) clearTimeout(midnightTimer);
  midnightTimer = setTimeout(() => {
    midnightTimer = null;
    fanoutPages("day");
    scheduleMidnight();
  }, msUntilNextUtcMidnight() + MIDNIGHT_MARGIN_MS);
}

export function startPageJobs(): void {
  if (running) return;
  running = true;
  unsubscribe.push(onPoolWritten((userId) => pokePage(userId, "pool")));
  unsubscribe.push(onProfileRebuilt((userId) => pokePage(userId, "profile")));
  scheduleMidnight();
  // Boot : index de bibliothèque des comptes actifs, puis les pages que le
  // jour ou un pool ont périmées pendant l'arrêt — rien de plus.
  bootTimer = setTimeout(() => {
    bootTimer = null;
    void (async () => {
      const accounts = await listActiveAccounts().catch(() => [] as string[]);
      await prewarmLibraryMemo(accounts.slice(0, PREWARM_ACCOUNTS));
      fanoutPages("boot");
    })();
  }, BOOT_DELAY_MS);
}

export function stopPageJobs(): void {
  running = false;
  for (const off of unsubscribe) off();
  unsubscribe.length = 0;
  if (midnightTimer) clearTimeout(midnightTimer);
  midnightTimer = null;
  if (bootTimer) clearTimeout(bootTimer);
  bootTimer = null;
  for (const t of pokeTimers.values()) clearTimeout(t);
  pokeTimers.clear();
}
