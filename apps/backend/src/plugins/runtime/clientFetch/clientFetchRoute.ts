import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { getTokenFromRequest, requireAuth } from "../../../middleware/auth";
import { hashToken } from "../../../services/jwt";
import { CLIENT_FETCH_LIMITS, CLIENT_FETCH_REPLY_ROUTE, type ClientFetchOutcome } from "../pluginClientFetch";
import type { ClientFetchBroker } from "./clientFetchBroker";

/**
 * `POST /api/client-fetch/:id` — la réponse d'un appareil à une requête
 * déléguée. Après `requireAuth` ; l'appareil est le hash du jeton de la requête,
 * qui doit être CELUI à qui la requête a été confiée (le courtier le vérifie).
 * 204 : rendue à l'extension ; 404 : inconnue, expirée ou d'un autre appareil.
 */

const REPLY = z.union([
  z.object({
    ok: z.literal(true),
    response: z.object({
      status: z.number().int().min(100).max(599),
      url: z.string().max(4096),
      headers: z.record(z.string().max(1024)).refine((h) => Object.keys(h).length <= 8),
      body: z.string(),
    }),
  }),
  z.object({ ok: z.literal(false), reason: z.enum(["offline", "refused", "timeout", "budget", "network", "tooLarge"]) }),
]);

/** Le corps : la réponse lue (2 Mo au plus), échappée en JSON (jusqu'à ~6 fois pour des caractères de contrôle). */
const BODY_LIMIT = CLIENT_FETCH_LIMITS.maxResponseBytes * 6 + 64 * 1024;

export async function registerClientFetchRoute(app: FastifyInstance, broker: () => ClientFetchBroker | null): Promise<void> {
  app.post<{ Params: { id: string } }>(
    `${CLIENT_FETCH_REPLY_ROUTE}/:id`,
    { preHandler: requireAuth, bodyLimit: BODY_LIMIT, config: { compress: false } },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const parsed = REPLY.safeParse(request.body);
      const token = getTokenFromRequest(request);
      const current = broker();
      if (!parsed.success || !token || !current || !/^[0-9a-f-]{36}$/.test(request.params.id)) return reply.status(400).send({ error: "invalid" });
      const accepted = current.accept(request.params.id, hashToken(token), parsed.data as ClientFetchOutcome);
      return accepted ? reply.status(204).send() : reply.status(404).send({ error: "notFound" });
    },
  );
}
