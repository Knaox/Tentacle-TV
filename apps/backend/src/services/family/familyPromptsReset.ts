import { getPrisma } from "../db";
import type { PromptsResetDto } from "../../family/familyContract";
import { canResetPrompts, familyRightsOf } from "../../family/familyRights";
import { restoreAccountHint } from "../../routes/preferences.hints";
import { getFamilySwitches, refuseReviewAccount } from "./familyConfig";
import { FamilyFailure } from "./familyErrors";
import type { Actor } from "./familyInvitations";
import { notifyFamily } from "./familyNotify";
import { familyOf, findProfile, memberKind } from "./familyStore";

/**
 * « Reproposer le code PIN et la photo » d'un profil de la famille (1.30.0,
 * `family.promptsReset`). Le premier passage d'un profil (code PIN conseillé,
 * photo) retient « Plus tard » SUR L'APPAREIL ; le serveur garde seulement la
 * date de la demande (`promptsResetAt`), rendue dans les profils : un appareil
 * qui avait retenu « Plus tard » avant la repropose une fois, si le code ou la
 * photo manquent toujours — la règle d'éligibilité de chaque étape ne change
 * pas. Sur le bureau, le rappel du code est une préférence du COMPTE
 * (`familyPin`) : il est réaffiché ici même.
 *
 * Droits : ceux du code ou de la photo du profil (`canResetPrompts`). Hors de
 * sa famille : 404 ; dans sa famille sans le droit : 403 (`family.not_owner`).
 */
export async function resetPrompts(actor: Actor, targetUserId: string, now: number): Promise<PromptsResetDto> {
  await refuseReviewAccount(actor.userId);
  const mine = await familyOf(actor.userId);
  const row = mine ? await findProfile(mine.family.id, targetUserId) : null;
  if (!mine || !row) throw new FamilyFailure("family.not_found", "Introuvable");
  const rights = familyRightsOf(mine.role, { createGuests: mine.self.canCreateGuests === true }, getFamilySwitches(), {
    parent: mine.self.isParent === true,
  });
  const kind = memberKind(row);
  const target = { userId: row.userId, kind, parent: row.isParent === true, createdBy: row.createdBy ?? mine.family.ownerUserId };
  if (!canResetPrompts(rights, target, actor.userId)) {
    throw new FamilyFailure("family.not_owner", "Réservé à ce profil, au propriétaire, à un parent ou au créateur de l'invité");
  }
  const at = new Date(now);
  await getPrisma().familyMember.update({ where: { id: row.id }, data: { promptsResetAt: at } });
  // Un invité n'a ni session personnelle ni rappel de code : seule la photo le concerne.
  if (kind !== "guest") await restoreAccountHint(row.userId, "familyPin");
  await notifyFamily(mine.family.id);
  console.log(`[family] Premier passage reproposé à un profil de la famille ${mine.family.id}`);
  return { promptsResetAt: at.toISOString() };
}
