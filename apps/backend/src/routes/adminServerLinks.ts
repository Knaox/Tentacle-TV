import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { buildServerLinksReport, checkServerLinksDraft } from "../services/serverLinks/serverLinksReport";

/**
 * Les liens du serveur — le lien public et la lecture directe — sondés
 * depuis le serveur. Enregistré depuis `adminRoutes`, donc derrière
 * `requireAdmin`. Contrat : `packages/shared/src/serverLinks/serverLinksContract.ts`.
 *
 * Rien ne s'écrit ici : l'enregistrement reste celui de `/public-url` et de
 * `/direct-streaming`, que la vue d'ensemble et l'assistant partagent avec la
 * page « Services ».
 */

/** Vide, ou une adresse http(s) : ce que les routes d'enregistrement acceptent. */
const link = z.string().max(2048).refine((value) => {
  const trimmed = value.trim();
  if (trimmed === "") return true;
  try {
    const url = new URL(trimmed);
    return (url.protocol === "http:" || url.protocol === "https:") && url.hostname !== "";
  } catch {
    return false;
  }
});

const draftSchema = z.object({ publicUrl: link, jellyfinPublicUrl: link, jellyfinPrivateUrl: link });

const requestOrigin = (origin: unknown): string | null => (typeof origin === "string" && origin !== "" ? origin : null);

export const adminServerLinksRoutes: FastifyPluginAsync = async (app) => {
  /** GET /api/admin/server-links — les liens enregistrés, et ce que leurs sondes ont trouvé. */
  app.get("/server-links", async (request) => buildServerLinksReport(requestOrigin(request.headers.origin)));

  /** POST /api/admin/server-links/check — un brouillon, sondé avant d'être enregistré. */
  app.post("/server-links/check", async (request, reply) => {
    const parsed = draftSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "invalid-body" });
    return checkServerLinksDraft(parsed.data, requestOrigin(request.headers.origin));
  });
};
