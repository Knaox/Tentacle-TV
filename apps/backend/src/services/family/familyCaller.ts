import type { FastifyReply, FastifyRequest } from "fastify";
import { getTokenFromRequest, validateToken } from "../../middleware/auth";
import { accountAccessReply, sessionAccessRefusal } from "../accountAccess/accountAccessState";
import { getPrisma } from "../db";
import { FAMILY_MANAGE_UNLOCK_MS } from "../../family/familyContract";
import { hashToken, verifyDeviceToken, verifyTvPairingToken } from "../jwt";
import { PROFILE_ENDED_REPLY, REVOKED_REPLY } from "../pairedDeviceStatus";
import type { FamilyCaller } from "../../family/familyCallers";
import type { FamilyRouteSpec } from "../../family/familyRoutes";
import { FamilyFailure, sendFamilyFailure } from "./familyErrors";
import { hasPin } from "./familyPins";
import { isPickerProfileSession } from "./familyPickerHosts";
import { tvManageRole } from "./familyTv";

/**
 * Qui appelle une route de la Famille — TOUJOURS déduit du jeton, jamais d'un
 * identifiant du corps ou de la query (SEC-F-01/02) —, et la table
 * `FAMILY_ROUTES` décide s'il en a le droit :
 *
 * - `personal` : le jeton Jellyfin du web, du bureau, du mobile ;
 * - `ownerProfile` / `memberProfile` : la session de profil du propriétaire de la
 *   famille / d'un membre, sur une TV ou un bureau de la famille, « Gérer les
 *   profils » ouvert par SON PIN (`familyCallers.ts`) : jamais sans code (1.30.0),
 *   dix minutes prolongées à chaque geste ;
 * - `tvProfile` : une session de profil d'une TV, quel qu'en soit le profil ;
 * - `desktopProfile` : une session de profil d'un bureau — le déverrouillage seul ;
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

type ManageVerdict = { role: "ownerProfile" | "memberProfile" } | { refuse: FamilyFailure };

/**
 * Qui gère depuis cette session de profil, si « Gérer les profils » est ouvert :
 * le rôle d'abord (`not_owner` : un membre sur un geste de propriétaire, le même
 * refus qu'en session personnelle), puis SON code (`manage_pin_required` : jamais
 * sans code, même retiré depuis l'ouverture), puis la fenêtre (`manage_locked`).
 * Un geste admis prolonge la fenêtre de dix minutes.
 */
async function manageVerdict(token: string, userId: string, callers: ReadonlySet<string>, now: number): Promise<ManageVerdict> {
  const prisma = getPrisma();
  const session = await prisma.pairedDevice.findUnique({ where: { tokenHash: hashToken(token) } });
  const pairing = session?.parentId ? await prisma.pairedDevice.findUnique({ where: { id: session.parentId } }) : null;
  const role = session && pairing ? await tvManageRole(userId, pairing.jellyfinUserId) : null;
  if (!session || !role || !callers.has(role)) {
    return { refuse: new FamilyFailure("family.not_owner", "Réservé au propriétaire de la famille") };
  }
  if (!(await hasPin(userId))) return { refuse: new FamilyFailure("family.manage_pin_required", "Gérer depuis un profil : code PIN requis") };
  if (session.manageUntil === null || session.manageUntil.getTime() <= now) {
    return { refuse: new FamilyFailure("family.manage_locked", "« Gérer les profils » : PIN requis") };
  }
  await prisma.pairedDevice.update({ where: { id: session.id }, data: { manageUntil: new Date(now + FAMILY_MANAGE_UNLOCK_MS) } });
  return { role };
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
      if (result.reason === "blocked") return reply.status(403).send(accountAccessReply(result.access));
      if (result.reason === "unreachable") return reply.status(503).send({ message: "Jellyfin unreachable" });
      if (result.profileEnded) return reply.status(401).send(PROFILE_ENDED_REPLY);
      return reply.status(401).send(result.revoked ? REVOKED_REPLY : { message: "Invalid token" });
    }
    const { userId, username, isAdmin, session } = result.user;
    // Désactivé ou hors plage : aucune route de la Famille (le sélecteur des TV, lui, reste ouvert).
    const refusal = await sessionAccessRefusal(result.user);
    if (refusal) return reply.status(403).send(refusal);
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
      // Une session de profil du BUREAU ne fait que gérer, derrière SON code
      // (1.30.0) : ni son PIN, ni les routes des TV (docs/FAMILLE.md, « Le bureau »).
      let desktop: boolean;
      try {
        desktop = await isPickerProfileSession(result.user.pairingId);
      } catch {
        return reply.status(503).send({ message: "Base de données indisponible" });
      }
      const profileCaller = desktop ? "desktopProfile" : "tvProfile";
      if (callers.has(profileCaller)) return actor(profileCaller);
      if (callers.has("ownerProfile") || callers.has("memberProfile")) {
        const verdict = await manageVerdict(token, userId, callers, Date.now());
        if ("refuse" in verdict) return sendFamilyFailure(reply, verdict.refuse);
        return actor(verdict.role);
      }
      if (desktop) return sendFamilyFailure(reply, forbidden());
      if (callers.has("tvPairing")) {
        return sendFamilyFailure(reply, new FamilyFailure("family.pairing_required", "Jeton de jumelage de TV requis"));
      }
    }
    // TV d'avant, session de profil hors de sa route, « voir en tant que » (SEC-F-04).
    return sendFamilyFailure(reply, forbidden());
  };
}
