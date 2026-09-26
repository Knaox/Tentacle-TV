import { BACKEND, creds, hdrs } from "../../pages/adminUtils";
import { PluginApiError } from "./pluginErrors";
import type { HealthSample } from "./restartMachine";

const BASE = `${BACKEND}/api/plugins`;

/**
 * Un appel à l'API d'administration des plugins, avec les en-têtes et la
 * règle de cookies de toute l'administration (`adminUtils`) — ce module en
 * gardait une copie, avec une règle de cookies à lui.
 */
export async function pluginApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { ...hdrs(), ...(init.headers as Record<string, string> | undefined) },
      credentials: creds(),
    });
  } catch {
    throw new PluginApiError(0, "");
  }
  if (!res.ok) throw new PluginApiError(res.status, await errorMessage(res));
  return (await res.json()) as T;
}

/** Le `message` d'une réponse d'erreur JSON, sinon le début du texte. */
async function errorMessage(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  try {
    const body = JSON.parse(text) as { message?: unknown };
    if (typeof body.message === "string") return body.message;
  } catch {
    /* pas du JSON : le texte brut */
  }
  return text.slice(0, 300);
}

/**
 * Un échantillon de `/api/health` pour le suivi d'un redémarrage. Ne lève
 * jamais : un serveur absent (connexion refusée, 502 d'un proxy) est un
 * échantillon « injoignable », c'est exactement ce qu'on attend de lui.
 */
export async function sampleHealth(signal?: AbortSignal): Promise<HealthSample> {
  try {
    const res = await fetch(`${BACKEND}/api/health`, { cache: "no-store", signal });
    if (!res.ok) return { reachable: false };
    const body = (await res.json()) as {
      bootId?: unknown;
      pluginBackends?: { loadResults?: HealthSample["loadResults"] };
    };
    return {
      reachable: true,
      bootId: typeof body.bootId === "string" ? body.bootId : null,
      loadResults: Array.isArray(body.pluginBackends?.loadResults) ? body.pluginBackends.loadResults : [],
    };
  } catch {
    return { reachable: false };
  }
}
