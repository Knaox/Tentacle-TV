/**
 * Routes de téléchargement (desktop) — GARDE SYSTÉMATIQUE côté backend.
 *
 * Chaque démarrage/reprise re-vérifie EN DIRECT la policy Jellyfin de
 * l'utilisateur (via SON token). Refus = 404 générique `{ error: "Not found" }`
 * — indiscernable d'une ressource inexistante : un compte sans droit ne doit
 * jamais apprendre que la fonctionnalité existe.
 *
 * Le pipe utilise le fetch global (keep-alive Node) : un téléchargement est
 * UNE connexion longue, pas une rafale de segments — le pool undici du proxy
 * n'apporterait rien ici, et le timeout d'inactivité par défaut (~5 min sans
 * octet) est une protection bienvenue contre les flux morts.
 * Jellyfin re-vérifie lui-même `EnableContentDownloading` sur /Download
 * (double enforcement, vérifié source v10.11.11).
 */

import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { Readable } from "node:stream";
import { requireAuth, getTokenFromRequest } from "../middleware/auth";
import { getJellyfinUrl } from "../services/configStore";
import {
  checkDownloadRight,
  getDownloadCapabilities,
  mediaBrowserAuthHeader,
} from "../services/jellyfinPolicy";

const ITEM_ID_RE = /^[0-9a-fA-F-]{32,36}$/;

/** En-têtes amont relayés tels quels vers le client (Range compris). */
const RELAYED_HEADERS = [
  "content-type",
  "content-length",
  "content-range",
  "accept-ranges",
  "content-disposition",
  "etag",
  "last-modified",
] as const;

function notFound(reply: FastifyReply) {
  return reply.status(404).send({ error: "Not found" });
}

export const downloadRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  /** Capacités de l'utilisateur courant. Sans droit → tout à false,
   *  indiscernable d'une fonctionnalité désactivée côté serveur. */
  app.get("/capabilities", async (request) => {
    const token = getTokenFromRequest(request);
    if (!token) return { downloads: false, lightDownloads: false };
    return getDownloadCapabilities(token);
  });

  /** Fichier original — pipe de `GET /Items/{id}/Download` (Range passthrough). */
  app.get("/original/:itemId", async (request, reply) => {
    const token = getTokenFromRequest(request);
    const { itemId } = request.params as { itemId: string };
    if (!token || !ITEM_ID_RE.test(itemId)) return notFound(reply);
    if (!(await checkDownloadRight(token, itemId))) return notFound(reply);

    const jellyfinUrl = getJellyfinUrl();
    if (!jellyfinUrl) return notFound(reply);

    const headers: Record<string, string> = {
      Authorization: mediaBrowserAuthHeader(token),
    };
    const range = request.headers.range;
    if (typeof range === "string" && range) headers.Range = range;

    let upstream: Response;
    try {
      upstream = await fetch(`${jellyfinUrl}/Items/${itemId}/Download`, { headers });
    } catch {
      return notFound(reply);
    }
    if ((upstream.status !== 200 && upstream.status !== 206) || !upstream.body) {
      return notFound(reply);
    }

    reply.status(upstream.status);
    for (const name of RELAYED_HEADERS) {
      const value = upstream.headers.get(name);
      if (value) reply.header(name, value);
    }
    return reply.send(
      Readable.fromWeb(upstream.body as unknown as import("node:stream/web").ReadableStream),
    );
  });
};
