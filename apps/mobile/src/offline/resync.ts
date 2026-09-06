/**
 * Synchronisation de l'état de visionnage, dans les deux sens.
 *
 * 1. La file locale est élaguée (rapports synchronisés de plus de sept jours,
 *    doublons non synchronisés).
 * 2. UNE lecture groupée de l'état serveur des titres concernés
 *    (`Users/{u}/Items?ids=…&enableUserData=true`, par paquets de cinquante) —
 *    les rapports en attente seuls (`pending`, à l'arrêt d'une lecture), ou
 *    tous les titres de l'appareil (`all`, au retour en ligne et au premier
 *    plan, au plus une fois par minute).
 * 3. Chaque rapport en attente est poussé, sauf si le serveur a vu le titre
 *    APRÈS lui (dernier écrivain gagne) ; un titre perdu pour le serveur
 *    (404…) est passé, une panne arrête le reste, qui attend.
 * 4. L'état serveur plus récent que le local est appliqué (`reconcile`).
 *
 * Un seul vol à la fois. Rien ici ne tourne pendant une lecture locale : les
 * appelants s'en assurent (`isLocalPlaybackActive`).
 */

import {
  applyServerUserData,
  completeItemIds,
  drainOutcome,
  markItemSynced,
  parseUserDataItems,
  pendingReports,
  pruneReportQueue,
  reportRequest,
  serverIsNewer,
  type PendingReport,
  type ServerUserData,
} from "@tentacle-tv/offline-core";
import { localDb } from "./database";
import { notifyOfflinePlaybackChanged } from "./engineRuntime";

export type SyncScope = "pending" | "all";

export interface SyncResult {
  pushed: number;
  pulled: number;
}

const TIMEOUT_MS = 12_000;
const PRUNE_AFTER_MS = 7 * 24 * 3_600_000;
const FULL_MIN_INTERVAL_MS = 60_000;
const CHUNK = 50;

let inFlight: Promise<SyncResult> | null = null;
let lastFullAt = 0;

/** `force` : un retour en ligne fait toujours le tour complet. */
export function syncPlaybackState(
  serverUrl: string,
  token: string,
  userId: string,
  scope: SyncScope,
  options: { force?: boolean } = {},
): Promise<SyncResult> {
  if (inFlight !== null) return inFlight;
  const now = Date.now();
  const effective: SyncScope = scope === "all" && !options.force && now - lastFullAt < FULL_MIN_INTERVAL_MS ? "pending" : scope;
  if (effective === "all") lastFullAt = now;
  inFlight = run(serverUrl, token, userId, effective)
    .catch(() => ({ pushed: 0, pulled: 0 }))
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

async function run(serverUrl: string, token: string, userId: string, scope: SyncScope): Promise<SyncResult> {
  const db = localDb();
  const now = Date.now();
  try {
    pruneReportQueue(db, userId, now - PRUNE_AFTER_MS);
  } catch {
    // Base locale indisponible : la file s'élaguera au prochain tour.
  }
  const pending = pendingReports(db, userId);
  const pendingIds = new Set(pending.map((report) => report.itemId));
  const ids = scope === "all" ? [...new Set([...completeItemIds(db, userId), ...pendingIds])] : [...pendingIds];
  if (ids.length === 0) return { pushed: 0, pulled: 0 };

  // Lecture groupée en échec : on pousse sans tirer, le tour suivant tirera.
  const server = await fetchUserData(serverUrl, token, userId, ids);

  let pushed = 0;
  const remaining = new Set<string>();
  for (let index = 0; index < pending.length; index += 1) {
    const report = pending[index] as PendingReport;
    if (server !== null && serverIsNewer(report, server.get(report.itemId))) {
      markItemSynced(db, userId, report.itemId, report.id);
      continue;
    }
    const outcome = await push(serverUrl, token, userId, report);
    if (outcome === "stop") {
      for (const rest of pending.slice(index)) remaining.add(rest.itemId);
      break;
    }
    markItemSynced(db, userId, report.itemId, report.id);
    if (outcome === "synced") pushed += 1;
  }

  let pulled = 0;
  if (server !== null && server.size > 0) {
    pulled = applyServerUserData(db, userId, [...server.values()], now, { pendingItemIds: remaining }).length;
  }
  if (pushed > 0 || pulled > 0) notifyOfflinePlaybackChanged();
  return { pushed, pulled };
}

function withTimeout(): { signal: AbortSignal; done: () => void } {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  return { signal: abort.signal, done: () => clearTimeout(timer) };
}

/** L'état serveur des titres, par identifiant ; `null` dès qu'un paquet échoue. */
async function fetchUserData(
  serverUrl: string,
  token: string,
  userId: string,
  ids: readonly string[],
): Promise<Map<string, ServerUserData> | null> {
  const out = new Map<string, ServerUserData>();
  for (let start = 0; start < ids.length; start += CHUNK) {
    const chunk = ids.slice(start, start + CHUNK);
    const { signal, done } = withTimeout();
    try {
      const url = `${serverUrl}/api/jellyfin/Users/${encodeURIComponent(userId)}/Items?ids=${chunk.join(",")}&enableUserData=true`;
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

async function push(serverUrl: string, token: string, userId: string, report: PendingReport) {
  const request = reportRequest(report, userId);
  const { signal, done } = withTimeout();
  try {
    // X-Emby-Token : format du proxy /api/jellyfin (un Bearer y ferait 401).
    const headers: Record<string, string> = { "X-Emby-Token": token };
    if (request.body !== null) headers["Content-Type"] = "application/json";
    const res = await fetch(`${serverUrl}/api/jellyfin/${request.path}`, {
      method: request.method,
      headers,
      body: request.body === null ? undefined : JSON.stringify(request.body),
      signal,
    });
    return drainOutcome(res.status);
  } catch {
    return drainOutcome(null);
  } finally {
    done();
  }
}
