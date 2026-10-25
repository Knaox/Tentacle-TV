/**
 * Octave — le son et l'image : la source d'un titre, son flux DIRECT (jamais
 * transcodé), les pochettes relayées et gardées, les rapports d'écoute.
 */

import type { FastifyInstance } from "fastify";
import { isItemVisibleTo } from "../../services/itemAccess/itemVisibility";
import { rowById } from "../index/indexQueries";
import { isJellyfinId, normalizeId } from "../jellyfin/musicJellyfin";
import { artworkFor, artworkSize } from "../media/artworkCache";
import { parsePlaybackReport, reportPlayback } from "../media/playbackReport";
import { playableRow, sourceFor } from "../media/playbackSource";
import { AUDIO_BYTES, relayStream } from "../media/streamRelay";
import { visibleRows, type UserView } from "../view/viewContext";
import { userOf, viewOf } from "./requestView";

/** L'image d'un élément de l'index (droits de l'index) ou d'une playlist (Jellyfin juge). */
async function mayShowImage(view: UserView, id: string): Promise<boolean> {
  if (view.access.mode === "none") return false;
  const row = await rowById(id);
  if (row) return visibleRows(view, [row]).length > 0;
  return isItemVisibleTo(view.userId, id);
}

export function musicMediaRoutes(app: FastifyInstance): void {
  app.get<{ Params: { id: string } }>("/source/:id", async (request, reply) => {
    if (!isJellyfinId(request.params.id)) return reply.status(404).send({ error: "not_found" });
    const source = await sourceFor(await viewOf(request), request.params.id);
    reply.header("cache-control", "private, no-store");
    return source ?? reply.status(404).send({ error: "not_found" });
  });

  app.get<{ Params: { id: string } }>("/stream/:id", AUDIO_BYTES, async (request, reply) => {
    if (!isJellyfinId(request.params.id)) return reply.status(404).send({ error: "not_found" });
    const row = await playableRow(await viewOf(request), request.params.id);
    if (!row) return reply.status(404).send({ error: "not_found" });
    return relayStream(request, reply, row.id);
  });

  app.get<{ Params: { id: string }; Querystring: { size?: string; tag?: string } }>("/artwork/:id", async (request, reply) => {
    if (!isJellyfinId(request.params.id)) return reply.status(404).send({ error: "not_found" });
    const id = normalizeId(request.params.id);
    if (!(await mayShowImage(await viewOf(request), id))) return reply.status(404).send({ error: "not_found" });
    const tag = typeof request.query.tag === "string" && /^[A-Za-z0-9]{1,64}$/.test(request.query.tag) ? request.query.tag : null;
    const image = await artworkFor(id, tag, artworkSize(request.query.size));
    if (!image) return reply.status(404).send({ error: "not_found" });
    // Privée (droits du compte) ; sous une étiquette, l'image ne change jamais à cette URL.
    reply.header("cache-control", image.immutable ? "private, max-age=31536000, immutable" : "private, max-age=300");
    reply.type(image.contentType);
    return reply.send(image.bytes);
  });

  app.post("/playback", async (request, reply) => {
    const report = parsePlaybackReport(request.body);
    if (!report) return reply.status(400).send({ error: "invalid_input" });
    const view = await viewOf(request);
    if (!(await playableRow(view, report.itemId))) return reply.status(404).send({ error: "not_found" });
    return reportPlayback(request, userOf(request).userId, { ...report, itemId: normalizeId(report.itemId) });
  });
}
