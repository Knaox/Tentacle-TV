import type { FastifyPluginAsync } from "fastify";
import { hashToken } from "../../services/jwt";
import { getFamilySwitches, setFamilySwitches } from "../../services/family/familyConfig";
import { getFamilyLaunchPolicy, setFamilyLaunchPolicy } from "../../services/family/familyLaunchPolicy";
import { accountFamilyRights, setAccountFamilyRights } from "../../services/family/familyAccountAdmin";
import { getCreationDefaults, setCreationDefaults } from "../../services/family/familyCreationRights";
import { endSessionsOfKinds } from "../../services/family/familySessions";
import { notifyAllFamilies } from "../../services/family/familyGuestRequests";
import { hasRequestExtension } from "../../services/pluginRequests";
import type { FamilyAdminSwitchesDto } from "../../family/familyContract";
import { listTvProfiles, openTvSession, unlockManage } from "../../services/family/familyTv";
import { enrollTv, pairingFromToken } from "../../services/family/familyTvEnroll";
import {
  accountCreationRightsBodySchema,
  adminLaunchPolicyBodySchema,
  adminSwitchesBodySchema,
  creationDefaultsBodySchema,
  manageUnlockBodySchema,
  openTvSessionBodySchema,
  userIdSchema,
} from "../../services/family/familySchemas";
import { actorOf, registerFamilyRoute } from "./familyRouting";

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
 * personnelle d'un administrateur — et « Qui regarde ? » à l'ouverture. Couper coupe AUSSITÔT les sessions de
 * profil concernées ; rallumer ne ressuscite aucune session (SEC-F-14).
 *
 * 1.30.0 : « Les invités peuvent demander des films » ne se montre que si une extension sait
 * demander un titre (`requestExtension`) ; le couper SUSPEND les cases des invités, le
 * rallumer les rend — chaque famille relit aussitôt (`notifyAllFamilies`).
 */
export const adminFamilyRoutes: FastifyPluginAsync = async (app) => {
  const adminSwitches = (): FamilyAdminSwitchesDto => ({ ...getFamilySwitches(), requestExtension: hasRequestExtension() });

  registerFamilyRoute(app, "adminSwitches", async () => adminSwitches());

  registerFamilyRoute(app, "adminSetSwitches", async (request) => {
    const patch = adminSwitchesBodySchema.parse(request.body);
    const before = getFamilySwitches();
    const after = await setFamilySwitches(patch);
    if (before.families && !after.families) await endSessionsOfKinds(["member", "guest"], "families_disabled");
    else if (after.families && before.guests && !after.guests) await endSessionsOfKinds(["guest"], "guests_disabled");
    if (before.guestRequests !== after.guestRequests) await notifyAllFamilies();
    console.log(
      `[family] Interrupteurs : familles ${after.families ? "oui" : "non"}, invités ${after.guests ? "oui" : "non"}, ` +
        `demandes des invités ${after.guestRequests ? "oui" : "non"}`,
    );
    return adminSwitches();
  });

  // « Qui regarde ? » à l'ouverture, plateforme par plateforme : aucune session
  // fermée — la règle vaut au prochain lancement de chaque appareil.
  registerFamilyRoute(app, "adminLaunchPolicy", async () => getFamilyLaunchPolicy());

  registerFamilyRoute(app, "adminSetLaunchPolicy", async (request) => {
    const policy = await setFamilyLaunchPolicy(adminLaunchPolicyBodySchema.parse(request.body));
    const desktop = `${policy.desktop.mode}${policy.desktop.mode === "choice" ? (policy.desktop.defaultOn ? "/oui" : "/non") : ""}`;
    console.log(`[family] « Qui regarde ? » à l'ouverture : bureau ${desktop}, TV ${policy.tv.mode}`);
    return policy;
  });

  // Les droits de création (1.30.0) : le défaut, et chaque compte. Rien de ce qui existe ne tombe.
  registerFamilyRoute(app, "adminCreationDefaults", async () => getCreationDefaults());

  registerFamilyRoute(app, "adminSetCreationDefaults", async (request, actor) => {
    const before = getCreationDefaults();
    const defaults = await setCreationDefaults(creationDefaultsBodySchema.parse(request.body ?? {}));
    // Le défaut du droit de donner « peut demander » suspend ou rend des cases d'invités.
    if (before.grantGuestRequests !== defaults.grantGuestRequests) await notifyAllFamilies();
    console.log(
      `[family] ${actor.username} → défaut : famille ${defaults.createFamily ? "oui" : "non"}, invités ${defaults.createGuests ? "oui" : "non"}, ` +
        `demandes des invités ${defaults.grantGuestRequests ? "oui" : "non"}`,
    );
    return defaults;
  });

  registerFamilyRoute(app, "adminAccountRights", async (request) =>
    accountFamilyRights(userIdSchema.parse((request.params as Record<string, unknown> | undefined)?.userId)),
  );

  registerFamilyRoute(app, "adminSetAccountRights", async (request, actor) =>
    setAccountFamilyRights(
      actorOf(actor),
      userIdSchema.parse((request.params as Record<string, unknown> | undefined)?.userId),
      accountCreationRightsBodySchema.parse(request.body ?? {}),
    ),
  );
};
