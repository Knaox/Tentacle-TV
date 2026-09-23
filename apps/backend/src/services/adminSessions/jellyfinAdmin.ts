import { fetch as undiciFetch } from "undici";
import { getJellyfinApiKey, getJellyfinUrl } from "../configStore";
import { getJellyfinDispatcher } from "../jellyfinHttpAgent";
import { latestSessionsFrame, sessionsLive } from "../jellyfinWs";
import type { AdminPlaystateCommand } from "./dto";

/**
 * Ce que le tableau de bord demande à Jellyfin, avec la clé d'administration
 * — qui ne quitte jamais le backend.
 *
 * La LISTE des sessions ne coûte en général aucune requête : le socket admin
 * de `jellyfinWs.ts` la reçoit déjà à chaque changement. On n'interroge
 * `/Sessions` que s'il ne livre plus (serveur redémarré, socket en reprise),
 * et le résultat sert deux secondes — la page relit toutes les trois.
 *
 * Les ACTIONS passent par Jellyfin, exactement comme depuis son propre tableau
 * de bord : il les relaie à la connexion de l'appareil. Pour un lecteur
 * Tentacle, c'est la connexion que tient le canal de session.
 */

const TIMEOUT_MS = 10_000;
const FETCH_CACHE_MS = 2_000;
/** Les sessions actives dans ce délai (secondes) — celui du tableau de bord de Jellyfin. */
const ACTIVE_WITHIN_SECONDS = 960;

let fetched: { sessions: unknown[]; at: number } | null = null;

function adminRequest(path: string, init: { method: string; body?: unknown }): Promise<Response | null> {
  const base = getJellyfinUrl();
  const key = getJellyfinApiKey();
  if (!base || !key) return Promise.resolve(null);
  return undiciFetch(`${base}${path}`, {
    method: init.method,
    headers: {
      Authorization: `MediaBrowser Token="${key}"`,
      ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    dispatcher: getJellyfinDispatcher(),
  }).then(
    (res) => res as unknown as Response,
    () => null,
  );
}

/** Les sessions de Jellyfin, telles quelles, et l'instant où elles valaient. */
export async function loadRawSessions(now = Date.now()): Promise<{ sessions: unknown[]; at: number }> {
  const frame = latestSessionsFrame();
  if (frame !== null && sessionsLive()) return frame;
  if (fetched !== null && now - fetched.at < FETCH_CACHE_MS) return fetched;
  const res = await adminRequest(`/Sessions?activeWithinSeconds=${ACTIVE_WITHIN_SECONDS}`, { method: "GET" });
  if (res === null || !res.ok) return fetched ?? frame ?? { sessions: [], at: now };
  const body: unknown = await res.json().catch(() => []);
  fetched = { sessions: Array.isArray(body) ? body : [], at: now };
  return fetched;
}

/** Stop, pause, reprise — relayés par Jellyfin à l'appareil. Vrai si Jellyfin l'a accepté. */
export async function sendPlaystate(sessionId: string, command: AdminPlaystateCommand): Promise<boolean> {
  const res = await adminRequest(
    `/Sessions/${encodeURIComponent(sessionId)}/Playing/${command}`,
    { method: "POST" },
  );
  await res?.arrayBuffer().catch(() => undefined);
  return res?.ok ?? false;
}

/** Un message à afficher sur l'appareil (`DisplayMessage`). */
export async function sendMessage(
  sessionId: string,
  message: { header: string; text: string; timeoutMs?: number },
): Promise<boolean> {
  const res = await adminRequest(`/Sessions/${encodeURIComponent(sessionId)}/Message`, {
    method: "POST",
    body: {
      Header: message.header,
      Text: message.text,
      ...(message.timeoutMs === undefined ? {} : { TimeoutMs: message.timeoutMs }),
    },
  });
  await res?.arrayBuffer().catch(() => undefined);
  return res?.ok ?? false;
}
