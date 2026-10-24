/**
 * Les requêtes DÉLÉGUÉES (capacité `plugins.clientFetch`) : une extension du
 * serveur demande au bureau d'exécuter une requête qu'elle a décrite, depuis la
 * connexion de l'utilisateur. La page reçoit le travail par le canal de session
 * et le passe ici ; le principal le juge contre le manifeste qu'il lit lui-même,
 * le plafonne (`clientFetchQuota.ts`) et l'exécute sans cookie
 * (`clientFetchRunner.ts`). Voir `pluginClientFetch.ts`.
 */

import { z } from "zod";
import { ClientFetchQuota } from "../clientFetch/clientFetchQuota";
import { runDelegated } from "../clientFetch/delegatedRun";
import { pluginManifests } from "../clientFetch/directSources";
import type { ClientFetchOutcome, ClientFetchRequest } from "../clientFetch/pluginClientFetch";
import { isValidPluginId } from "../pluginDocuments";
import type { CommandRegistry } from "./registry";

const RUN = z.object({
  serverOrigin: z.string().min(1).max(2048).refine((v) => /^https?:\/\//.test(v)),
  headers: z.record(z.string().max(4096)),
  pluginId: z.string().refine(isValidPluginId),
  request: z.object({
    method: z.enum(["GET", "POST"]),
    url: z.string().max(4096),
    headers: z.record(z.string().max(8192)).optional(),
    body: z.string().max(256 * 1024).optional(),
    timeoutMs: z.number().int().positive().optional(),
    maxBytes: z.number().int().positive().optional(),
  }),
});

/** Ce qui a été exécuté (hôte et chemin, jamais la requête ni la réponse) : diagnostic et banc. */
export interface ClientFetchLogEntry {
  t: number;
  pluginId: string;
  host: string;
  path: string;
  outcome: number | string;
  ms: number;
}

const quota = new ClientFetchQuota();
const log: ClientFetchLogEntry[] = [];

function remember(entry: ClientFetchLogEntry): void {
  log.push(entry);
  if (log.length > 200) log.splice(0, log.length - 200);
}

export function registerClientFetchCommands(registry: CommandRegistry): void {
  registry
    .add("client_fetch_run", {
      schema: RUN,
      run: async ({ serverOrigin, headers, pluginId, request }): Promise<ClientFetchOutcome> => {
        const started = Date.now();
        const target = URL.canParse(request.url) ? new URL(request.url) : null;
        const note = (outcome: ClientFetchOutcome) => {
          remember({ t: started, pluginId, host: target?.hostname ?? "?", path: target?.pathname ?? "?", outcome: outcome.ok ? outcome.response.status : outcome.reason, ms: Date.now() - started });
          return outcome;
        };
        // Les champs absents restent absents (le contrat n'admet pas `undefined`).
        const clean: ClientFetchRequest = Object.fromEntries(Object.entries(request).filter(([, v]) => v !== undefined)) as unknown as ClientFetchRequest;
        return note(await runDelegated({ serverOrigin, headers, pluginId, request: clean }, { manifests: pluginManifests, quota }));
      },
    })
    .add("client_fetch_log", { schema: z.object({}).passthrough(), run: () => log.slice() });
}
