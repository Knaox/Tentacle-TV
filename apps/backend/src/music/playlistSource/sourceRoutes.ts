/**
 * Octave — `POST /api/music/playlists/:id/source-order` (capacité `music.playlistSourceOrder`) : remettre une
 * playlist importée dans l'ordre de sa source (`sourceRepair.ts`). Corps : `{}` (l'ordre gardé à l'import),
 * `{ url }` (la source relue par le cœur : Apple Music, Spotify, Deezer) ou `{ playlist }` (lue par l'extension) ;
 * `dryRun: true` rend le plan sans rien écrire. Le PROPRIÉTAIRE seulement (`CanDelete`), en session personnelle
 * ou de profil — jamais « voir en tant que ».
 */

import type { FastifyInstance } from "fastify";
import { capabilityGate } from "../../serverCapabilities/declaredCapabilities";
import { isJellyfinId } from "../jellyfin/musicJellyfin";
import { networkFetcher } from "../playlistImport/importFetch";
import { playlistOf } from "../playlistImport/importInput";
import { userOf, viewOf } from "../routes/requestView";
import { repairSourceOrder, type RepairDeps, type RepairFailure, type RepairSource } from "./sourceRepair";

const gate = capabilityGate("music.playlistSourceOrder");
const STATUS: Record<RepairFailure, number> = { not_found: 404, forbidden: 403, source_unknown: 409, unsupported: 400, source_unavailable: 502, unavailable: 503 };

function sourceOf(body: Record<string, unknown>): RepairSource | null {
  if (body.url !== undefined && body.playlist !== undefined) return null;
  if (typeof body.url === "string") return body.url.length <= 2_048 ? { kind: "url", url: body.url } : null;
  if (body.playlist !== undefined) {
    const playlist = playlistOf(body.playlist);
    return playlist ? { kind: "playlist", playlist } : null;
  }
  return body.url === undefined ? { kind: "kept" } : null;
}

export function musicSourceOrderRoutes(app: FastifyInstance, deps: RepairDeps = { fetcher: networkFetcher }): void {
  app.post<{ Params: { id: string }; Body: unknown }>(
    "/playlists/:id/source-order",
    { onRequest: gate, config: { rateLimit: { max: 10, timeWindow: 10 * 60_000 } } },
    async (request, reply) => {
      if (userOf(request).session === "impersonation") return reply.status(403).send({ error: "forbidden" });
      const body = (request.body && typeof request.body === "object" ? request.body : {}) as Record<string, unknown>;
      const source = sourceOf(body);
      if (!isJellyfinId(request.params.id) || !source) return reply.status(400).send({ error: "invalid_input" });
      const view = await viewOf(request);
      if (view.access.mode === "none") return reply.status(404).send({ error: "not_found" });
      const outcome = await repairSourceOrder(view.userId, request.params.id, source, body.dryRun === true, deps);
      reply.header("cache-control", "private, no-store");
      return outcome.ok ? outcome.value : reply.status(STATUS[outcome.failure]).send({ error: outcome.failure });
    },
  );
}
