/**
 * Octave — `POST /api/music/import` et son suivi (capacité
 * `music.playlistImport`). Mêmes droits que « Nouvelle playlist » (la porte
 * d'Octave, puis un compte qui voit la musique) : la playlist est créée AU
 * NOM du compte de la session (profil de la Famille compris, jamais « voir en
 * tant que »), privée. Seul ce compte lit l'avancée de SON import.
 */

import type { FastifyInstance } from "fastify";
import { capabilityGate } from "../../serverCapabilities/declaredCapabilities";
import { createPlaylist } from "../playlists/playlistService";
import { userOf, viewOf } from "../routes/requestView";
import { userView } from "../view/viewContext";
import { networkFetcher } from "./importFetch";
import { getImport, startImport, type ImportDeps } from "./importJobs";
import { parseImportRequest } from "./importInput";

const gate = capabilityGate("music.playlistImport");

const deps: ImportDeps = { fetcher: networkFetcher, view: userView, create: createPlaylist };

export function musicImportRoutes(app: FastifyInstance, overrides: Partial<ImportDeps> = {}): void {
  const used = { ...deps, ...overrides };

  app.post("/import", { onRequest: gate, config: { rateLimit: { max: 20, timeWindow: 10 * 60_000 } } }, async (request, reply) => {
    // « Voir en tant que » regarde : il ne crée rien au nom de l'autre compte.
    if (userOf(request).session === "impersonation") return reply.status(403).send({ error: "forbidden" });
    const parsed = parseImportRequest(request.body);
    if (!parsed.ok) return reply.status(400).send({ error: parsed.refusal });
    const view = await viewOf(request);
    if (view.access.mode === "none") return reply.status(404).send({ error: "not_found" });
    const started = startImport(userOf(request).userId, parsed.value, used);
    if (!started.ok) return reply.status(429).send({ error: "busy" });
    return reply.status(202).send({ jobId: started.jobId });
  });

  app.get<{ Params: { jobId: string } }>("/import/:jobId", { onRequest: gate }, async (request, reply) => {
    reply.header("cache-control", "private, no-store");
    const job = getImport(userOf(request).userId, request.params.jobId);
    return job ?? reply.status(404).send({ error: "not_found" });
  });
}
