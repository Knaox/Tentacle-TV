/**
 * GET /api/account/abilities — ce que la session peut faire (capacité
 * `account.abilities`) : la règle `accountAbilitiesOf`, nourrie des droits que
 * chaque porte applique déjà. Privée, jamais servie d'un cache partagé.
 */

import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { getTokenFromRequest, requireAuth, type JellyfinUser } from "../middleware/auth";
import { accountAbilitiesOf } from "../accountAbilities/accountAbilities";
import type { AccountAbilitiesDto } from "../accountAbilities/accountAbilitiesContract";
import { isFamilyGuest } from "../services/family/familyGuestMarkers";
import { guestExtensionAccess } from "../services/family/familyGuestExtensions";
import { getDownloadCapabilities } from "../services/jellyfinPolicy";
import { readDeletionRights } from "../services/libraryDelete/libraryDeletion";
import { getRealClientIp } from "../services/networkUtils";
import { playbackRightsFor } from "../services/playbackRights";
import { mayShareInPublic } from "../services/share/publicSharingRight";
import { wtAccessOf } from "../services/watchTogether/accountAccess";

const NO_DELETION = { everywhere: false, libraryIds: [] as string[] };

export const accountAbilitiesRoutes: FastifyPluginAsync = async (app) => {
  app.get("/abilities", { preHandler: [requireAuth] }, async (request, reply): Promise<AccountAbilitiesDto> => {
    reply.header("Cache-Control", "private, no-store");
    const user = (request as FastifyRequest & { user: JellyfinUser }).user;
    const token = getTokenFromRequest(request);
    const profile = user.session === "tvProfile";
    const personal = user.session === "personal";
    // Fermé à l'échec, droit par droit : une source muette vaut « non ».
    const guest = profile ? await isFamilyGuest(user.userId).catch(() => true) : false;
    const [playback, downloads, watchTogether, publicSharing, deletion, extension] = await Promise.all([
      playbackRightsFor(user.userId, getRealClientIp(request)).then((r) => r.mediaPlayback).catch(() => false),
      personal && token ? getDownloadCapabilities(token).then((c) => c.downloads).catch(() => false) : false,
      wtAccessOf(user.userId).catch(() => "none" as const),
      mayShareInPublic(user.userId).catch(() => false),
      personal && token ? readDeletionRights(token).catch(() => NO_DELETION) : NO_DELETION,
      guest ? guestExtensionAccess(user.userId).catch(() => "denied" as const) : null,
    ]);
    return accountAbilitiesOf({
      session: user.session,
      isAdmin: user.isAdmin,
      guest,
      playback,
      downloads,
      watchTogether,
      publicSharing,
      deletion,
      guestExtensions: extension !== null && extension !== "denied",
    });
  });
};
