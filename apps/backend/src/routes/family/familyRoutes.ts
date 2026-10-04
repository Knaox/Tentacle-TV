import type { FastifyPluginAsync } from "fastify";
import { buildOverview } from "../../services/family/familyOverview";
import { listCandidates } from "../../services/family/familyCandidates";
import { cancelInvitation, inviteMember } from "../../services/family/familyInvitations";
import { acceptInvitation, declineInvitation, snoozeInvitation } from "../../services/family/familyInvitationAnswers";
import { createGuest, deleteGuest, setGuestPin, setGuestRights } from "../../services/family/familyGuests";
import { setOwnPin } from "../../services/family/familyOwnPin";
import { hashToken } from "../../services/jwt";
import { dissolveFamily, leaveFamily, removeMember, setMemberRights } from "../../services/family/familyMembers";
import {
  candidatesQuerySchema,
  createGuestBodySchema,
  dissolveBodySchema,
  familyIdSchema,
  invitationActionBodySchema,
  inviteBodySchema,
  setGuestRightsBodySchema,
  setMemberRightsBodySchema,
  setOwnPinBodySchema,
  setPinBodySchema,
  userIdSchema,
} from "../../services/family/familySchemas";
import { actorOf, registerFamilyRoute } from "./familyRouting";

/**
 * Les routes de la Famille sous `/api/family` — sessions personnelles (web,
 * bureau, mobile) et, pour la gestion et son propre PIN, les sessions de
 * profil sur les TV. Qui peut quoi : `FAMILY_ROUTES` (le contrat). L'acteur
 * vient du jeton.
 */

function param(params: unknown, key: string): unknown {
  return (params as Record<string, unknown> | undefined)?.[key];
}

export const familyRoutes: FastifyPluginAsync = async (app) => {
  registerFamilyRoute(app, "overview", async (_request, actor, now) =>
    buildOverview({ ...actorOf(actor), personal: actor.as === "personal" }, now),
  );

  registerFamilyRoute(app, "candidates", async (request, actor, now) => {
    const { q } = candidatesQuerySchema.parse(request.query ?? {});
    return listCandidates(actorOf(actor), q ?? "", now);
  });

  registerFamilyRoute(app, "invite", async (request, actor, now) => {
    const { userId } = inviteBodySchema.parse(request.body);
    return inviteMember(actorOf(actor), userId, now);
  });

  registerFamilyRoute(app, "cancelInvite", async (request, actor, now) => {
    const { id } = invitationActionBodySchema.parse(request.body);
    return cancelInvitation(actorOf(actor), id, now);
  });

  registerFamilyRoute(app, "acceptInvite", async (request, actor, now) => {
    const { id } = invitationActionBodySchema.parse(request.body);
    return acceptInvitation(actorOf(actor), id, now);
  });

  registerFamilyRoute(app, "declineInvite", async (request, actor, now) => {
    const { id } = invitationActionBodySchema.parse(request.body);
    return declineInvitation(actorOf(actor), id, now);
  });

  registerFamilyRoute(app, "snoozeInvite", async (request, actor, now) => {
    const { id } = invitationActionBodySchema.parse(request.body);
    return snoozeInvitation(actorOf(actor), id, now);
  });

  registerFamilyRoute(app, "createGuest", async (request, actor, now) => {
    const body = createGuestBodySchema.parse(request.body);
    return createGuest(actorOf(actor), body, now);
  });

  registerFamilyRoute(app, "deleteGuest", async (request, actor) =>
    deleteGuest(actorOf(actor), userIdSchema.parse(param(request.params, "userId"))),
  );

  registerFamilyRoute(app, "setGuestRights", async (request, actor) =>
    setGuestRights(
      actorOf(actor),
      userIdSchema.parse(param(request.params, "userId")),
      setGuestRightsBodySchema.parse(request.body ?? {}),
    ),
  );

  registerFamilyRoute(app, "setGuestPin", async (request, actor) => {
    const { pin } = setPinBodySchema.parse(request.body);
    return setGuestPin(actorOf(actor), userIdSchema.parse(param(request.params, "userId")), pin);
  });

  registerFamilyRoute(app, "removeMember", async (request, actor) =>
    removeMember(actorOf(actor), userIdSchema.parse(param(request.params, "userId"))),
  );

  registerFamilyRoute(app, "setMemberRights", async (request, actor) =>
    setMemberRights(
      actorOf(actor),
      userIdSchema.parse(param(request.params, "userId")),
      setMemberRightsBodySchema.parse(request.body ?? {}),
    ),
  );

  registerFamilyRoute(app, "leave", async (request, actor) =>
    leaveFamily(actorOf(actor), familyIdSchema.parse(param(request.params, "familyId"))),
  );

  registerFamilyRoute(app, "setOwnPin", async (request, actor, now) => {
    const body = setOwnPinBodySchema.parse(request.body);
    // Depuis une TV : la session qui agit reste — c'est celle de CE jeton.
    const tvSessionTokenHash = actor.as === "tvProfile" ? hashToken(actor.token) : null;
    return setOwnPin({ ...actorOf(actor), tvSessionTokenHash }, body, now);
  });

  registerFamilyRoute(app, "dissolve", async (request, actor, now) => {
    dissolveBodySchema.parse(request.body);
    return dissolveFamily(actorOf(actor), now);
  });
};
