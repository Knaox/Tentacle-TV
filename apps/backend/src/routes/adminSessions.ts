import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { commandDeclaredPlayback, declaredPlaybacks, sessionConnections } from "../services/deviceSessions/gateway";
import { DECLARED_SESSION_PREFIX } from "../services/deviceSessions/declaredPlayback";
import { loadRawSessions, sendMessage, sendPlaystate } from "../services/adminSessions/jellyfinAdmin";
import { buildSnapshot } from "../services/adminSessions/snapshot";
import { transcodeMemory } from "../services/adminSessions/transcodeMemory";
import type { AdminGroupActionResultDto } from "../services/adminSessions/dto";
import { allRooms, getRoom } from "../services/watchTogether/roomRegistry";
import { postAdminChat } from "../services/watchTogether/chat";
import { dissolveRoom, isRoomIdle, onlineMemberCount } from "../services/watchTogether/roomDissolve";
import { isCapabilityDeclared } from "../serverCapabilities/declaredCapabilities";
import type { JellyfinUser } from "../middleware/auth";
import { familyGuestOwners } from "../services/family/familyGuestMarkers";
import { refusesMessage } from "../services/adminSessions/listening";

/**
 * Le tableau de bord des sessions en direct — enregistré depuis adminRoutes,
 * donc derrière `requireAdmin`. Voir `services/adminSessions/`.
 *
 * Les actions de GROUPE (Watch Together) partent à tous — et la réponse dit
 * combien les ont reçues. Depuis `sessions.groupChat` (1.50.0), elles valent
 * aussi pour une salle SANS lecture : le message entre dans le chat de la salle
 * (chaque appareil lié le reçoit), « Arrêter pour tous » ferme une salle où
 * personne ne lit. Avant : la session Jellyfin de chaque membre qui lit (un
 * lecteur sans télécommande, comme les applications mobiles d'avant, n'en
 * reçoit aucune) — et un groupe sans lecture ne recevait rien.
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
  // Les invités de la Famille, étiquetés (base muette : sans étiquette, rien de plus).
  const familyGuests = await familyGuestOwners().catch(() => new Map<string, string>());
  return buildSnapshot({
    raw: sessions, receivedAt: at, connections: sessionConnections(), rooms: allRooms(), now, familyGuests, transcodes: transcodeMemory,
    declared: declaredPlaybacks(),
  });
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
    // Une lecture d'extension n'existe pas pour Jellyfin : la commande part par le canal.
    if (sessionId.startsWith(DECLARED_SESSION_PREFIX)) {
      return commandDeclaredPlayback(sessionId, command)
        ? { ok: true }
        : reply.status(404).send({ ok: false, message: "Lecture introuvable" });
    }
    const ok = await sendPlaystate(sessionId, command);
    return ok ? { ok } : reply.status(502).send({ ok, message: "Jellyfin a refusé la commande" });
  });

  /** POST /api/admin/sessions/:sessionId/message — un message à afficher. */
  app.post("/sessions/:sessionId/message", async (request, reply) => {
    const { sessionId } = sessionParams.parse(request.params);
    const message = messageBody.parse(request.body);
    // Une écoute n'affiche rien : pas de message (le tableau de bord ne le propose pas). Une lecture
    // d'extension en est toujours une, même disparue entre-temps.
    if (sessionId.startsWith(DECLARED_SESSION_PREFIX) || refusesMessage((await snapshot()).sessions.find((s) => s.id === sessionId))) {
      return reply.status(409).send({ ok: false, message: "Pas de message pour une écoute" });
    }
    const ok = await sendMessage(sessionId, message);
    return ok ? { ok } : reply.status(502).send({ ok, message: "Jellyfin a refusé le message" });
  });

  /** POST /api/admin/watch-groups/:groupId/message — le même message à tous les membres. */
  app.post("/watch-groups/:groupId/message", async (request, reply) => {
    const { groupId } = groupParams.parse(request.params);
    const message = messageBody.parse(request.body);
    // Dans le chat de la salle : chaque appareil lié le lit, en lecture ou non. La durée
    // d'affichage d'un bandeau n'a pas de sens dans un fil : elle est ignorée.
    if (isCapabilityDeclared("sessions.groupChat")) {
      const room = getRoom(groupId);
      if (!room) return reply.status(404).send({ message: "Groupe introuvable" });
      const author = (request as { user?: JellyfinUser }).user?.username ?? "";
      postAdminChat(room, author, message);
      request.log.info({ groupId, members: room.members.size }, "[wt] message de l'administration au groupe");
      const result: AdminGroupActionResultDto = { delivered: onlineMemberCount(room), total: room.members.size, viaChat: true };
      return result;
    }
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
    // Personne ne lit : il n'y a rien à arrêter — « Arrêter pour tous » ferme la salle.
    const room = getRoom(groupId);
    if (isCapabilityDeclared("sessions.groupChat") && room && targets.ids.length === 0 && isRoomIdle(room)) {
      const total = room.members.size;
      const notified = dissolveRoom(room);
      request.log.info({ groupId, members: total }, "[wt] groupe fermé par l'administration");
      const result: AdminGroupActionResultDto = { delivered: notified, total, dissolved: true };
      return result;
    }
    const results = await Promise.all(targets.ids.map((id) => sendPlaystate(id, "Stop")));
    const result: AdminGroupActionResultDto = { delivered: results.filter(Boolean).length, total: targets.total };
    return result;
  });
};
