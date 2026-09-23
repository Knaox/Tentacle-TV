import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { sessionConnections } from "../services/deviceSessions/gateway";
import { loadRawSessions, sendMessage, sendPlaystate } from "../services/adminSessions/jellyfinAdmin";
import { buildSnapshot } from "../services/adminSessions/snapshot";
import type { AdminGroupActionResultDto } from "../services/adminSessions/dto";
import { allRooms } from "../services/watchTogether/roomRegistry";

/**
 * Le tableau de bord des sessions en direct — enregistré depuis adminRoutes,
 * donc derrière `requireAdmin`. Voir `services/adminSessions/`.
 *
 * Les actions de GROUPE (Watch Together) visent la session Jellyfin de chaque
 * membre : un message, un arrêt, partent à tous — et la réponse dit combien
 * les ont reçus (un lecteur sans télécommande, comme les applications mobiles
 * d'avant, n'en reçoit aucune).
 */

const sessionParams = z.object({ sessionId: z.string().regex(/^[A-Za-z0-9-]{1,64}$/) });
const groupParams = z.object({ groupId: z.string().min(1).max(64) });

const playstateBody = z.object({ command: z.enum(["Pause", "Unpause", "Stop"]) });

const messageBody = z.object({
  header: z.string().trim().max(100).default(""),
  text: z.string().trim().min(1).max(1_000),
  /** Absent : le message reste jusqu'à ce qu'on le ferme. */
  timeoutMs: z.number().int().min(3_000).max(600_000).optional(),
});

async function snapshot() {
  const now = Date.now();
  const { sessions, at } = await loadRawSessions(now);
  return buildSnapshot({ raw: sessions, receivedAt: at, connections: sessionConnections(), rooms: allRooms(), now });
}

/** Les sessions Jellyfin des membres d'une salle — `null` si la salle n'existe pas. */
async function groupSessionIds(groupId: string): Promise<{ ids: string[]; total: number } | null> {
  const snap = await snapshot();
  const group = snap.groups.find((g) => g.groupId === groupId);
  if (!group) return null;
  return {
    ids: group.members.map((m) => m.sessionId).filter((id): id is string => id !== null),
    total: group.members.length,
  };
}

export const adminSessionsRoutes: FastifyPluginAsync = async (app) => {
  /** GET /api/admin/sessions — l'instantané : sessions et salles. */
  app.get("/sessions", async () => snapshot());

  /** POST /api/admin/sessions/:sessionId/playstate — pause, reprise, arrêt. */
  app.post("/sessions/:sessionId/playstate", async (request, reply) => {
    const { sessionId } = sessionParams.parse(request.params);
    const { command } = playstateBody.parse(request.body);
    const ok = await sendPlaystate(sessionId, command);
    return ok ? { ok } : reply.status(502).send({ ok, message: "Jellyfin a refusé la commande" });
  });

  /** POST /api/admin/sessions/:sessionId/message — un message à afficher. */
  app.post("/sessions/:sessionId/message", async (request, reply) => {
    const { sessionId } = sessionParams.parse(request.params);
    const message = messageBody.parse(request.body);
    const ok = await sendMessage(sessionId, message);
    return ok ? { ok } : reply.status(502).send({ ok, message: "Jellyfin a refusé le message" });
  });

  /** POST /api/admin/watch-groups/:groupId/message — le même message à tous les membres. */
  app.post("/watch-groups/:groupId/message", async (request, reply) => {
    const { groupId } = groupParams.parse(request.params);
    const message = messageBody.parse(request.body);
    const targets = await groupSessionIds(groupId);
    if (!targets) return reply.status(404).send({ message: "Groupe introuvable" });
    const results = await Promise.all(targets.ids.map((id) => sendMessage(id, message)));
    const result: AdminGroupActionResultDto = { delivered: results.filter(Boolean).length, total: targets.total };
    return result;
  });

  /** POST /api/admin/watch-groups/:groupId/stop — la lecture s'arrête pour tout le groupe. */
  app.post("/watch-groups/:groupId/stop", async (request, reply) => {
    const { groupId } = groupParams.parse(request.params);
    const targets = await groupSessionIds(groupId);
    if (!targets) return reply.status(404).send({ message: "Groupe introuvable" });
    const results = await Promise.all(targets.ids.map((id) => sendPlaystate(id, "Stop")));
    const result: AdminGroupActionResultDto = { delivered: results.filter(Boolean).length, total: targets.total };
    return result;
  });
};
