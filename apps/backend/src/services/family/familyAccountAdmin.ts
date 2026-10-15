import { getPrisma } from "../db";
import { getJellyfinUsers } from "../watchTogether/usersCache";
import { resolveFamilyCreation, type AccountFamilyRightsDto, type SetAccountFamilyRightsBody } from "../../family/familyRoles";
import { getFamilySwitches } from "./familyConfig";
import { accountCreationRights, getCreationDefaults, setAccountCreationRights } from "./familyCreationRights";
import { FamilyFailure } from "./familyErrors";
import type { Actor } from "./familyInvitations";
import { familyUpdate } from "./familyNotify";
import { findFamily, fold } from "./familyStore";
import { readMemberParental } from "./memberParentalStore";

/**
 * La fiche « Famille » d'un compte dans l'administration (`/api/admin/family/accounts/:userId`,
 * administrateur en session personnelle) : ses droits de création, ce qui en vaut, sa place dans
 * une famille et, s'il est un membre mineur, la famille qui le restreint. Un compte inconnu de
 * Jellyfin : `family.not_found` ; un invité de la Famille ne se règle pas (`family.guest_account`).
 */

export async function accountFamilyRights(userId: string): Promise<AccountFamilyRightsDto> {
  const key = fold(userId);
  const users = await getJellyfinUsers();
  const user = users?.find((entry) => fold(entry.id) === key);
  if (users && !user) throw new FamilyFailure("family.not_found", "Compte inconnu de Jellyfin");
  const nameOf = (id: string, fallback: string) => users?.find((entry) => fold(entry.id) === fold(id))?.name ?? fallback;
  const [rights, row] = await Promise.all([accountCreationRights(key), getPrisma().familyMember.findUnique({ where: { userId: user?.id ?? userId } })]);
  const family = row ? await findFamily(row.familyId) : null;
  const role = row?.kind === "owner" || row?.kind === "member" || row?.kind === "guest" ? row.kind : null;
  const ownerName = family ? nameOf(family.ownerUserId, family.ownerName) : "";
  const isAdministrator = user ? user.isAdministrator : null;
  const defaults = getCreationDefaults();
  const allowed =
    role === "guest"
      ? { createFamily: false, createGuests: false }
      : resolveFamilyCreation({ rights, defaults, switches: getFamilySwitches(), isAdministrator: isAdministrator === true });
  const parental = role === "member" && row ? await readMemberParental(row.userId) : null;
  return {
    userId: user?.id ?? userId,
    rights,
    defaults,
    allowed,
    isAdministrator,
    family: role && family ? { role, ownerName, parent: row?.isParent === true } : null,
    restrictedBy: parental?.controls ? { ownerName } : null,
  };
}

export async function setAccountFamilyRights(admin: Actor, userId: string, patch: SetAccountFamilyRightsBody): Promise<AccountFamilyRightsDto> {
  const before = await accountFamilyRights(userId);
  if (before.family?.role === "guest") throw new FamilyFailure("family.guest_account", "Un invité de la Famille ne crée rien");
  const rights = await setAccountCreationRights(before.userId, patch);
  // Sa page de la Famille se relit : ce qu'il peut créer vient de changer.
  familyUpdate([before.userId], "family");
  console.log(`[family] ${admin.username} → droits de création d'un compte : famille ${rights.createFamily}, invités ${rights.createGuests}`);
  return accountFamilyRights(before.userId);
}
