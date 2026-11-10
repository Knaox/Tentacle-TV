/**
 * Synchronisation de l'état de visionnage du bureau, dans les DEUX sens — le
 * pendant de `apps/mobile/src/offline/resync.ts`.
 *
 * Le bureau ne faisait que POUSSER (`resync.ts`) : une série regardée sur un
 * autre appareil restait « jamais vue » dans la base locale, et « Reprendre »
 * du catalogue hors ligne relançait l'épisode 1. Ici :
 *
 * 1. UNE lecture groupée de l'état serveur des titres concernés
 *    (`Users/{u}/Items?ids=…&enableUserData=true`, par paquets de cinquante) ;
 * 2. chaque rapport en attente est poussé, sauf si le serveur a vu le titre
 *    APRÈS lui (dernier écrivain gagne) ;
 * 3. l'état serveur est remis à la coquille (`downloads_playback_reconcile`),
 *    qui ne l'applique que s'il est plus récent que le local (`reconcile.ts`).
 *
 * Trois moments : un titre vient d'arriver sur la machine (ses identifiants),
 * le retour du réseau et le démarrage (`all`, forcé), l'ouverture du catalogue
 * (`all`, au plus une fois par minute). Une coquille d'avant, sans la
 * commande, pousse comme avant et ne lit rien. Un seul vol à la fois ; rien
 * ne lève.
 */

import { drainOutcome, parseUserDataItems, reportBody, serverIsNewer, type ServerUserData } from "@tentacle-tv/offline-core";
import { invoke, supportsDownloads } from "../desktop/bridge";
import { supportsPlaybackReconcile } from "../desktop/capabilities";
import { listDownloads } from "../downloads/api";
import { getBackendBase } from "../lib/backendBase";
import { markReportSynced, pendingReports } from "../downloads/playbackApi";

export type SyncScope = "all" | readonly string[];

export interface SyncResult {
  pushed: number;
  pulled: number;
}

const NOTHING: SyncResult = { pushed: 0, pulled: 0 };
const TIMEOUT_MS = 12_000;
const FULL_MIN_INTERVAL_MS = 60_000;
const CHUNK = 50;

let inFlight: Promise<SyncResult> | null = null;
let lastFullAt = 0;

/** Pour les tests : oublie le dernier tour complet. */
export function resetPlaybackSync(): void {
  inFlight = null;
  lastFullAt = 0;
}

/** `force` : le retour du réseau et le démarrage font toujours le tour complet. */
export function syncPlaybackState(userId: string, scope: SyncScope, options: { force?: boolean } = {}): Promise<SyncResult> {
  if (!supportsDownloads()) return Promise.resolve(NOTHING);
  if (inFlight !== null) {
    // Un tour est en vol : le tour complet s'y joint ; des titres précis
    // (ils viennent d'arriver) passent juste après, jamais oubliés.
    return scope === "all" ? inFlight : inFlight.then(() => syncPlaybackState(userId, scope, options));
  }
  const now = Date.now();
  // Un tour complet trop rapproché ne relit rien : il ne fait que pousser.
  const effective: SyncScope = scope === "all" && !options.force && now - lastFullAt < FULL_MIN_INTERVAL_MS ? [] : scope;
  if (effective === "all") lastFullAt = now;
  inFlight = run(userId, effective)
    .catch(() => NOTHING)
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

function readToken(): string | null {
  try {
    return localStorage.getItem("tentacle_token");
  } catch {
    return null;
  }
}

async function run(userId: string, scope: SyncScope): Promise<SyncResult> {
  const token = readToken();
  if (!token) return NOTHING;

  const pending = await pendingReports(userId);
  const pendingIds = new Set(pending.map((report) => report.itemId));
  const canPull = supportsPlaybackReconcile();
  const kept = !canPull ? [] : scope === "all" ? await completeItemIds(userId) : scope;
  const ids = [...new Set([...kept, ...(canPull ? pendingIds : [])])];

  // Lecture en échec : on pousse sans tirer, le tour suivant tirera.
  const server = ids.length === 0 ? null : await fetchUserData(userId, token, ids);

  let pushed = 0;
  const remaining = new Set<string>();
  for (let index = 0; index < pending.length; index += 1) {
    const report = pending[index];
    if (report === undefined) continue;
    if (server !== null && serverIsNewer(report, server.get(report.itemId))) {
      await markReportSynced(userId, report.itemId, report.id);
      continue;
    }
    const outcome = await push(token, report.itemId, reportBody(report));
    if (outcome === "stop") {
      for (const rest of pending.slice(index)) remaining.add(rest.itemId);
      break;
    }
    await markReportSynced(userId, report.itemId, report.id);
    if (outcome === "synced") pushed += 1;
  }

  let pulled = 0;
  if (server !== null && server.size > 0) {
    const changed = await invoke<string[]>("downloads_playback_reconcile", {
      userId,
      entries: [...server.values()],
      pendingItemIds: [...remaining],
    });
    pulled = Array.isArray(changed) ? changed.length : 0;
  }
  return { pushed, pulled };
}

/** Les titres COMPLETS du compte sur cette machine. */
async function completeItemIds(userId: string): Promise<string[]> {
  const entries = await listDownloads(userId);
  return [...new Set(entries.filter((entry) => entry.status === "complete").map((entry) => entry.itemId))];
}

function withTimeout(): { signal: AbortSignal; done: () => void } {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  return { signal: abort.signal, done: () => clearTimeout(timer) };
}

/** L'état serveur des titres, par identifiant ; `null` dès qu'un paquet échoue. */
async function fetchUserData(userId: string, token: string, ids: readonly string[]): Promise<Map<string, ServerUserData> | null> {
  const out = new Map<string, ServerUserData>();
  for (let start = 0; start < ids.length; start += CHUNK) {
    const chunk = ids.slice(start, start + CHUNK);
    const { signal, done } = withTimeout();
    try {
      const url = `${getBackendBase()}/api/jellyfin/Users/${encodeURIComponent(userId)}/Items?ids=${chunk.join(",")}&enableUserData=true`;
      // X-Emby-Token : format du proxy /api/jellyfin (un Bearer y ferait 401).
      const res = await fetch(url, { headers: { "X-Emby-Token": token }, signal });
      if (!res.ok) return null;
      for (const entry of parseUserDataItems(await res.json())) out.set(entry.itemId, entry);
    } catch {
      return null;
    } finally {
      done();
    }
  }
  return out;
}

/** Même requête que `drainReportQueue` : position, « vu », date réelle. */
async function push(token: string, itemId: string, body: Record<string, unknown>) {
  const { signal, done } = withTimeout();
  try {
    const res = await fetch(`${getBackendBase()}/api/jellyfin/UserItems/${itemId}/UserData`, {
      method: "POST",
      headers: { "X-Emby-Token": token, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    return drainOutcome(res.status);
  } catch {
    return drainOutcome(null);
  } finally {
    done();
  }
}

/**
 * Les titres devenus COMPLETS depuis le relevé précédent — ceux dont l'état
 * de lecture est à tirer. `known === null` : premier relevé, le démarrage a
 * déjà fait le tour complet.
 */
export function freshlyKept(known: ReadonlySet<string> | null, complete: ReadonlySet<string>): string[] {
  if (known === null) return [];
  return [...complete].filter((itemId) => !known.has(itemId));
}

/** Une bascule « vu » que le serveur vient d'accepter (`WATCHED_GESTURE_META`, api-client). */
export function isWatchedGestureSuccess(event: {
  type: string;
  action?: { type?: string };
  mutation?: { options: { meta?: Record<string, unknown> } };
}): boolean {
  return event.type === "updated" && event.action?.type === "success" && event.mutation?.options.meta?.userDataGesture === "watched";
}
