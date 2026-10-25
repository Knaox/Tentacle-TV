/**
 * Octave — le flux DIRECT d'un titre : le fichier tel qu'il est
 * (`/Audio/{id}/stream?static=true` de Jellyfin, jamais transcodé), relayé
 * avec sa plage (`Range` → 206, `Content-Range`, `Accept-Ranges`). Le départ
 * du client coupe la requête amont (`requestSignal`) : un saut dans le titre
 * ne laisse pas une lecture orpheline chez Jellyfin.
 */

import type { FastifyReply, FastifyRequest } from "fastify";
import { Readable } from "node:stream";
import { requestSignal } from "../../routes/jellyfinProxy/clientAbort";
import { jfRaw, q } from "../jellyfin/musicJellyfin";

/** Option de route : les octets audio ne se recompressent pas (la compression globale tiendrait un WAV pour compressible). */
export const AUDIO_BYTES = { compress: false } as const;

const PASSED = ["content-type", "content-length", "content-range", "accept-ranges", "last-modified", "etag"];

export async function relayStream(request: FastifyRequest, reply: FastifyReply, itemId: string): Promise<FastifyReply> {
  const headers: Record<string, string> = {};
  const range = request.headers.range;
  if (typeof range === "string" && /^bytes=\d*-\d*(,\s*\d*-\d*)*$/.test(range)) headers.Range = range;
  const ifRange = request.headers["if-range"];
  if (typeof ifRange === "string" && headers.Range) headers["If-Range"] = ifRange;
  const upstream = await jfRaw(`/Audio/${q(itemId)}/stream?static=true`, { headers, signal: requestSignal(request, reply, 2 * 60 * 60_000) });
  if (!upstream) return reply.status(503).send({ error: "unavailable" });
  if (!upstream.ok || !upstream.body) {
    await upstream.body?.cancel().catch(() => undefined);
    return reply.status(upstream.status === 416 ? 416 : 404).send({ error: upstream.status === 416 ? "range_not_satisfiable" : "not_found" });
  }
  reply.status(upstream.status);
  for (const name of PASSED) {
    const value = upstream.headers.get(name);
    if (value) reply.header(name, value);
  }
  // Privé : le flux est servi à CE compte, sous ses droits.
  reply.header("Cache-Control", "private, max-age=3600");
  return reply.send(Readable.fromWeb(upstream.body as unknown as import("node:stream/web").ReadableStream));
}
