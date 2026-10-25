/**
 * L'AGENT des requêtes déléguées, côté page (capacité `plugins.clientFetch`) :
 * il reçoit par le canal de session les requêtes qu'une extension confie à CET
 * appareil (`plugin:clientFetch`), les fait exécuter par l'`executor` de la
 * plateforme (le principal du bureau) et rend la réponse au serveur
 * (`POST /api/client-fetch/:id`). Une requête que l'exécuteur ne sait pas
 * faire, ou qui le fait échouer, revient `refused` : l'extension passe alors
 * par le serveur, jamais d'attente sans fin.
 */

import {
  CLIENT_FETCH_MESSAGE,
  CLIENT_FETCH_REPLY_ROUTE,
  type ClientFetchJob,
  type ClientFetchOutcome,
} from "@tentacle-tv/shared/pluginClientFetch";
import { acquireSocket, subscribeSocket } from "../socket/tentacleSocket";
import { tentacleApiFetch, tentacleApiSession, type TentacleApiSession } from "../hooks/usePreferences";
import { setClientFetchAnnounced } from "./clientFetchAnnounce";

export type ClientFetchExecutor = (job: ClientFetchJob, session: TentacleApiSession) => Promise<ClientFetchOutcome>;

/** Le message est-il une requête déléguée bien formée ? (la socket n'est pas crue sur parole) */
export function isClientFetchJob(msg: unknown): msg is ClientFetchJob {
  const m = msg as Partial<ClientFetchJob> | null;
  return (
    !!m && m.type === CLIENT_FETCH_MESSAGE && typeof m.id === "string" && /^[0-9a-f-]{36}$/.test(m.id) &&
    typeof m.pluginId === "string" && !!m.request && typeof m.request === "object" && typeof m.request.url === "string"
  );
}

async function answer(job: ClientFetchJob, executor: ClientFetchExecutor): Promise<void> {
  let outcome: ClientFetchOutcome;
  try {
    outcome = await executor(job, tentacleApiSession());
  } catch {
    outcome = { ok: false, reason: "refused" };
  }
  await tentacleApiFetch<unknown>(`${CLIENT_FETCH_REPLY_ROUTE}/${job.id}`, { method: "POST", body: JSON.stringify(outcome) }).catch(() => undefined);
}

/** Démarre l'agent (socket partagée, annonce de l'appareil) ; rend l'arrêt. */
export function startClientFetchAgent(executor: ClientFetchExecutor, token?: string | null): () => void {
  setClientFetchAnnounced(true);
  const release = acquireSocket(token ?? undefined);
  const off = subscribeSocket((msg) => {
    const raw: unknown = msg;
    if (isClientFetchJob(raw)) void answer(raw, executor);
  });
  return () => {
    off();
    release();
    setClientFetchAnnounced(false);
  };
}
