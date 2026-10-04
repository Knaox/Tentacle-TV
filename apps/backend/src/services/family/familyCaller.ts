import type { FastifyReply, FastifyRequest } from "fastify";
import { getTokenFromRequest, validateToken } from "../../middleware/auth";
import { getPrisma } from "../db";
import { hashToken, verifyDeviceToken, verifyTvPairingToken } from "../jwt";
import { PROFILE_ENDED_REPLY, REVOKED_REPLY } from "../pairedDeviceStatus";
import type { FamilyCaller, FamilyRouteSpec } from "../../family/familyRoutes";
import { FamilyFailure, sendFamilyFailure } from "./familyErrors";
import { hasPin } from "./familyPins";
import { tvManageRole } from "./familyTv";

/**
 * Qui appelle une route de la Famille — TOUJOURS déduit du jeton, jamais d'un
 * identifiant du corps ou de la query (SEC-F-01/02) —, et la table
 * `FAMILY_ROUTES` décide s'il en a le droit :
 *
 * - `personal` : le jeton Jellyfin du web, du bureau, du mobile ;
 * - `ownerTv` / `memberTv` : la session de profil du propriétaire de la
 *   famille / d'un membre, sur une TV de la famille, « Gérer les profils »
 *   ouvert par SON PIN (ouvert d'office s'il n'en a pas) ;
 * - `tvProfile` : une session de profil, quel qu'en soit le profil ;
 * - `tvPairing` / `tvLegacy` : les jetons de jumelage, jugés par leur route ;
 * - `admin` : un administrateur EN SESSION PERSONNELLE.
 *
 * Un refus d'appelant dit pourquoi (403) sans rien révéler d'autre ; un jeton
 * invalide reçoit la réponse des portes (401, `revoked`, `profileEnded`).
 */

export interface FamilyActor {
  userId: string;
  username: string;
  isAdmin: boolean;
  /** Appelant retenu par la table. */
  as: FamilyCaller;
  token: string;
}

declare module "fastify" {
  interface FastifyRequest {
    familyActor?: FamilyActor;
  }
}

function forbidden(): FamilyFailure {
  return new FamilyFailure("family.personal_session_required", "Geste réservé à une session personnelle");
}

/** Qui gère depuis cette session de profil, et « Gérer les profils » est-il ouvert ? */
async function manageVerdict(token: string, userId: string, now: number): Promise<{ role: "ownerTv" | "memberTv" | null; open: boolean }> {
  const prisma = getPrisma();
  const session = await prisma.pairedDevice.findUnique({ where: { tokenHash: hashToken(token) } });
  const pairing = session?.parentId ? await prisma.pairedDevice.findUnique({ where: { id: session.parentId } }) : null;
  if (!session || !pairing) return { role: null, open: false };
  const role = await tvManageRole(userId, pairing.jellyfinUserId);
  const open = (session.manageUntil !== null && session.manageUntil.getTime() > now) || !(await hasPin(userId));
  return { role, open };
}

/** Une `preHandler` par route : pose `request.familyActor`, ou répond le refus. */
export function familyGuard(spec: FamilyRouteSpec) {
  const callers = new Set<string>(spec.callers);
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const token = getTokenFromRequest(request);
    if (!token) return reply.status(401).send({ message: "Unauthorized" });

    const pairing = await verifyTvPairingToken(token);
    if (pairing) {
      if (callers.has("tvPairing")) {
        request.familyActor = { userId: pairing.userId, username: pairing.username, isAdmin: false, as: "tvPairing", token };
        return;
      }
      // Le jeton de jumelage n'ouvre que ses trois routes (SEC-F-19).
      return reply.status(401).send({ message: "Invalid token" });
    }
    if (callers.has("tvLegacy")) {
      // L'échange juge lui-même le jeton d'avant : déjà échangé, il ne vaut
      // plus rien ailleurs, mais rejoue encore l'échange (réponse perdue).
      const device = await verifyDeviceToken(token);
      if (device && !device.scope) {
        request.familyActor = { userId: device.userId, username: device.username, isAdmin: false, as: "tvLegacy", token };
        return;
      }
    }

    const result = await validateToken(token);
    if (!result.ok) {
      if (result.reason === "unreachable") return reply.status(503).send({ message: "Jellyfin unreachable" });
      if (result.profileEnded) return reply.status(401).send(PROFILE_ENDED_REPLY);
      return reply.status(401).send(result.revoked ? REVOKED_REPLY : { message: "Invalid token" });
    }
    const { userId, username, isAdmin, session } = result.user;
    const actor = (as: FamilyActor["as"]): void => {
      request.familyActor = { userId, username, isAdmin, as, token };
    };

    if (session === "personal") {
      if (callers.has("personal")) return actor("personal");
      if (callers.has("admin")) {
        if (isAdmin) return actor("admin");
        return reply.status(403).send({ message: "Forbidden" });
      }
      // Une route de TV appelée par une session personnelle : ce n'est pas son jeton.
      return sendFamilyFailure(reply, new FamilyFailure("family.pairing_required", "Jeton de jumelage de TV requis"));
    }
    if (session === "tvLegacy") {
      if (callers.has("tvLegacy")) return actor("tvLegacy");
      if (callers.has("tvPairing")) {
        return sendFamilyFailure(reply, new FamilyFailure("family.enroll_required", "La TV doit d'abord passer aux profils"));
      }
    }
    if (session === "tvProfile") {
      if (callers.has("tvProfile")) return actor("tvProfile");
      if (callers.has("ownerTv") || callers.has("memberTv")) {
        const { role, open } = await manageVerdict(token, userId, Date.now());
        // Un membre sur un geste de propriétaire : le même refus qu'en session personnelle.
        if (!role || !callers.has(role)) {
          return sendFamilyFailure(reply, new FamilyFailure("family.not_owner", "Réservé au propriétaire de la famille"));
        }
        if (!open) return sendFamilyFailure(reply, new FamilyFailure("family.manage_locked", "« Gérer les profils » : PIN requis"));
        return actor(role);
      }
      if (callers.has("tvPairing")) {
        return sendFamilyFailure(reply, new FamilyFailure("family.pairing_required", "Jeton de jumelage de TV requis"));
      }
    }
    // TV d'avant, session de profil hors de sa route, « voir en tant que » (SEC-F-04).
    return sendFamilyFailure(reply, forbidden());
  };
}
