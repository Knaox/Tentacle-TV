import type { FastifyPluginAsync } from "fastify";
import { getPickerPreference, listPickerProfiles, pickProfile, setPickerPreference, type PickerCaller } from "../../services/family/familyPicker";
import { pickProfileBodySchema, pickerQuerySchema, setPickerPreferenceBodySchema } from "../../services/family/familySchemas";
import type { FamilyActor } from "../../services/family/familyCaller";
import { escrowAccount, personalTokenFromRequest, releaseAccount } from "./accountEscrow";
import { registerFamilyRoute } from "./familyRouting";

/**
 * « Qui regarde ? » hors des TV (sous `/api/family/picker`) : la SESSION
 * PERSONNELLE de l'appareil, et elle seule (`FAMILY_ROUTES`, `picker*`) —
 * jamais une session de profil, ni « voir en tant que ». Son jeton désigne
 * l'hôte des sessions de profil de cet appareil (docs/FAMILLE.md, « Le bureau »).
 *
 * Le WEB (plateforme `web`, 1.32.0) : pendant un profil, le navigateur n'a plus
 * le jeton du compte — ces routes le lisent dans la réserve que le serveur a
 * posée en ouvrant le profil (`accountEscrow.ts`), et le choix d'un profil
 * réécrit les cookies : le profil devient la session (le compte en réserve),
 * ou le compte reprend derrière SON code (la réserve s'efface, son jeton est
 * rendu à la page).
 */

function pickerCaller(actor: FamilyActor): PickerCaller {
  return { userId: actor.userId, username: actor.username, token: actor.token };
}

const personal = { tokenOf: personalTokenFromRequest };

export const familyPickerRoutes: FastifyPluginAsync = async (app) => {
  registerFamilyRoute(app, "pickerProfiles", async (request, actor, now) => {
    const { platform } = pickerQuerySchema.parse(request.query ?? {});
    return listPickerProfiles(pickerCaller(actor), platform, now);
  }, personal);

  registerFamilyRoute(app, "pickProfile", async (request, actor, now, reply) => {
    const body = pickProfileBodySchema.parse(request.body);
    const picked = await pickProfile(pickerCaller(actor), body, now);
    if (body.platform !== "web") return picked;
    if (picked.personal) {
      releaseAccount(reply, actor.token);
      return { ...picked, token: actor.token };
    }
    escrowAccount(reply, actor.token, picked.token);
    return picked;
  }, personal);

  registerFamilyRoute(app, "pickerPreference", async (_request, actor) => getPickerPreference(pickerCaller(actor)), personal);

  registerFamilyRoute(app, "setPickerPreference", async (request, actor) =>
    setPickerPreference(pickerCaller(actor), setPickerPreferenceBodySchema.parse(request.body)),
  personal);
};
