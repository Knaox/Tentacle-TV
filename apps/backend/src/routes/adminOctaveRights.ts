import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { requirePersonalAdmin } from "../middleware/auth";
import {
  OCTAVE_RIGHTS_REFUSAL_STATUS,
  OCTAVE_RIGHTS_ROUTES,
  parseOctaveRightsBody,
  type OctaveAccountRightsDto,
  type OctaveRightsRefusal,
} from "../octaveRights/octaveRightsContract";
import { guestCreatorOf, guestsCreatedBy, storedOctaveAccess, writeOctaveAccess } from "../services/octaveRights/octaveAccess";
import { getJellyfinUsers, invalidateJellyfinUsers } from "../services/watchTogether/usersCache";
import { fold } from "../services/family/familyStore";
import { forgetIsolatedRights } from "../plugins/runtime/accountRights";
import { sendMusicEvent } from "../music/events/musicSend";

/**
 * « Accès à Octave » d'un compte (`OCTAVE_RIGHTS_ROUTES`, capacité
 * `octave.rights`). Enregistré depuis `adminRoutes` (derrière `requireAdmin`),
 * puis gardé par `requirePersonalAdmin` : jamais une TV jumelée, une session de
 * profil ni « voir en tant que ». Un invité de la Famille ne se règle pas : il
 * suit son créateur (`family_guest`).
 */

const PREFIX = "/api/admin";
const local = (path: string) => path.slice(PREFIX.length);

function refuse(reply: FastifyReply, error: OctaveRightsRefusal) {
  return reply.status(OCTAVE_RIGHTS_REFUSAL_STATUS[error]).send({ error });
}

function userIdOf(params: unknown): string | null {
  const value = (params as Record<string, unknown> | undefined)?.userId;
  return typeof value === "string" && /^[0-9a-fA-F-]{32,36}$/.test(value) ? value : null;
}

/** Le compte, s'il existe dans Jellyfin ; `unavailable` si Jellyfin se tait. */
async function knownUser(userId: string, retry = true): Promise<string | OctaveRightsRefusal> {
  const users = await getJellyfinUsers();
  if (!users) return "unavailable";
  const user = users.find((entry) => fold(entry.id) === fold(userId));
  if (user) return user.id;
  // La liste est gardée 30 s : un compte tout juste créé se relit une fois.
  if (!retry) return "unknown_user";
  invalidateJellyfinUsers();
  return knownUser(userId, false);
}

export const adminOctaveRightsRoutes: FastifyPluginAsync = async (app) => {
  app.get(local(OCTAVE_RIGHTS_ROUTES.read.path), { preHandler: requirePersonalAdmin }, async (request, reply) => {
    const userId = userIdOf(request.params);
    if (!userId) return refuse(reply, "unknown_user");
    const known = await knownUser(userId);
    if (known === "unknown_user" || known === "unavailable") return refuse(reply, known);
    if ((await guestCreatorOf(known)) !== null) return refuse(reply, "family_guest");
    const dto: OctaveAccountRightsDto = { userId: known, access: await storedOctaveAccess(known) };
    return dto;
  });

  app.put(
    local(OCTAVE_RIGHTS_ROUTES.update.path),
    { preHandler: requirePersonalAdmin, config: { rateLimit: { max: 60, timeWindow: 60_000 } } },
    async (request, reply) => {
      const userId = userIdOf(request.params);
      if (!userId) return refuse(reply, "unknown_user");
      const body = parseOctaveRightsBody(request.body);
      if (!body) return refuse(reply, "invalid_value");
      const known = await knownUser(userId);
      if (known === "unknown_user" || known === "unavailable") return refuse(reply, known);
      if ((await guestCreatorOf(known)) !== null) return refuse(reply, "family_guest");
      if (body.access !== undefined) {
        await writeOctaveAccess(known, body.access);
        // L'extension de musique se relit (relais, `/api/plugins/active`), et les clients du compte
        // et de ses invités relisent `/api/music/status` (`music:provider` vide les requêtes musique).
        forgetIsolatedRights();
        sendMusicEvent([known, ...(await guestsCreatedBy(known))], { type: "music:provider" });
        request.log.info({ target: fold(known), access: body.access }, "[octave-rights] accès à Octave réglé");
      }
      const dto: OctaveAccountRightsDto = { userId: known, access: await storedOctaveAccess(known) };
      return dto;
    },
  );
};
