import type { FastifyPluginAsync } from "fastify";
import { hashToken } from "../../services/jwt";
import { getFamilySwitches, setFamilySwitches } from "../../services/family/familyConfig";
import { endSessionsOfKinds } from "../../services/family/familySessions";
import { listTvProfiles, openTvSession, unlockManage } from "../../services/family/familyTv";
import { enrollTv, pairingFromToken } from "../../services/family/familyTvEnroll";
import { adminSwitchesBodySchema, manageUnlockBodySchema, openTvSessionBodySchema } from "../../services/family/familySchemas";
import { registerFamilyRoute } from "./familyRouting";

/**
 * L'Apple TV (sous `/api/family/tv`) : l'échange du jeton, « Qui regarde ? »,
 * l'ouverture d'une session de profil, « Gérer les profils ». Le jeton de
 * jumelage n'ouvre QUE ces routes (et le déjumelage) — docs/FAMILLE.md.
 */
export const familyTvRoutes: FastifyPluginAsync = async (app) => {
  registerFamilyRoute(app, "tvEnroll", async (_request, actor) => enrollTv(actor.token));

  registerFamilyRoute(app, "tvProfiles", async (_request, actor, now) => listTvProfiles(await pairingFromToken(actor.token), now));

  registerFamilyRoute(app, "tvOpenSession", async (request, actor, now) => {
    const body = openTvSessionBodySchema.parse(request.body);
    return openTvSession(await pairingFromToken(actor.token), body, now);
  });

  registerFamilyRoute(app, "tvManageUnlock", async (request, actor, now) => {
    const { pin } = manageUnlockBodySchema.parse(request.body ?? {});
    return unlockManage(hashToken(actor.token), pin, now);
  });
};

/**
 * Les interrupteurs de l'administration (sous `/api/admin`), en session
 * personnelle d'un administrateur. Couper coupe AUSSITÔT les sessions de
 * profil concernées ; rallumer ne ressuscite aucune session (SEC-F-14).
 */
export const adminFamilyRoutes: FastifyPluginAsync = async (app) => {
  registerFamilyRoute(app, "adminSwitches", async () => getFamilySwitches());

  registerFamilyRoute(app, "adminSetSwitches", async (request) => {
    const patch = adminSwitchesBodySchema.parse(request.body);
    const before = getFamilySwitches();
    const after = await setFamilySwitches(patch);
    if (before.families && !after.families) await endSessionsOfKinds(["member", "guest"], "families_disabled");
    else if (after.families && before.guests && !after.guests) await endSessionsOfKinds(["guest"], "guests_disabled");
    console.log(`[family] Interrupteurs : familles ${after.families ? "oui" : "non"}, invités ${after.guests ? "oui" : "non"}`);
    return after;
  });
};
