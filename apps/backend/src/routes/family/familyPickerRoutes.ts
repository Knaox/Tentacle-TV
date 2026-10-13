import type { FastifyPluginAsync } from "fastify";
import { getPickerPreference, listPickerProfiles, pickProfile, setPickerPreference, type PickerCaller } from "../../services/family/familyPicker";
import { pickProfileBodySchema, pickerQuerySchema, setPickerPreferenceBodySchema } from "../../services/family/familySchemas";
import type { FamilyActor } from "../../services/family/familyCaller";
import { registerFamilyRoute } from "./familyRouting";

/**
 * « Qui regarde ? » sur le bureau (sous `/api/family/picker`) : la SESSION
 * PERSONNELLE de l'appareil, et elle seule (`FAMILY_ROUTES`, `picker*`) —
 * jamais une session de profil, ni « voir en tant que ». Son jeton désigne
 * l'hôte des sessions de profil de cet appareil (docs/FAMILLE.md, « Le bureau »).
 */

function pickerCaller(actor: FamilyActor): PickerCaller {
  return { userId: actor.userId, username: actor.username, token: actor.token };
}

export const familyPickerRoutes: FastifyPluginAsync = async (app) => {
  registerFamilyRoute(app, "pickerProfiles", async (request, actor, now) => {
    const { platform } = pickerQuerySchema.parse(request.query ?? {});
    return listPickerProfiles(pickerCaller(actor), platform, now);
  });

  registerFamilyRoute(app, "pickProfile", async (request, actor, now) =>
    pickProfile(pickerCaller(actor), pickProfileBodySchema.parse(request.body), now),
  );

  registerFamilyRoute(app, "pickerPreference", async (_request, actor) => getPickerPreference(pickerCaller(actor)));

  registerFamilyRoute(app, "setPickerPreference", async (request, actor) =>
    setPickerPreference(pickerCaller(actor), setPickerPreferenceBodySchema.parse(request.body)),
  );
};
