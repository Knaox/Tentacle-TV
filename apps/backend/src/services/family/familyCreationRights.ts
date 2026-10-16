import { getConfigValue, setConfigValue } from "../configStore";
import { getPrisma } from "../db";
import { hasRequestExtension } from "../pluginRequests";
import { getJellyfinUsers } from "../watchTogether/usersCache";
import {
  FAMILY_DEFAULT_CREATION_RIGHTS,
  creationRightValue,
  resolveFamilyCreation,
  type FamilyCreationAllowed,
  type FamilyCreationDefaults,
  type FamilyCreationRights,
  type SetAccountFamilyRightsBody,
  type SetFamilyCreationDefaultsBody,
} from "../../family/familyRoles";
import { getFamilySwitches } from "./familyConfig";
import { FamilyFailure } from "./familyErrors";
import { fold } from "./familyStore";

/**
 * Les droits de création d'un compte (docs/DROITS-UTILISATEURS.md § 9.4) — fonder
 * une famille, créer des profils invités. Gardés par Tentacle : le réglage de
 * chaque compte dans `family_account_rights` (sans ligne : `inherit`), le défaut
 * de l'administration dans `server_config` (clé absente : NON, sur une
 * installation neuve comme sur une mise à jour). Les interrupteurs restent
 * maîtres ; un administrateur Jellyfin peut toujours. Jellyfin muet : on ne le
 * sait pas administrateur — son réglage et le défaut décident (fermé à l'échec).
 *
 * Rien de ce qui existe ne tombe : seules les NOUVELLES créations se gardent.
 */

export const FAMILY_DEFAULT_CREATE_FAMILY_KEY = "family_default_create_family";
export const FAMILY_DEFAULT_CREATE_GUESTS_KEY = "family_default_create_guests";
/** 1.30.0 : autoriser ses invités à demander des films — clé absente : NON. */
export const FAMILY_DEFAULT_GRANT_GUEST_REQUESTS_KEY = "family_default_grant_guest_requests";

export function getCreationDefaults(): FamilyCreationDefaults {
  return {
    createFamily: getConfigValue(FAMILY_DEFAULT_CREATE_FAMILY_KEY) === "true",
    createGuests: getConfigValue(FAMILY_DEFAULT_CREATE_GUESTS_KEY) === "true",
    grantGuestRequests: getConfigValue(FAMILY_DEFAULT_GRANT_GUEST_REQUESTS_KEY) === "true",
  };
}

export async function setCreationDefaults(patch: SetFamilyCreationDefaultsBody): Promise<FamilyCreationDefaults> {
  if (patch.createFamily !== undefined) await setConfigValue(FAMILY_DEFAULT_CREATE_FAMILY_KEY, String(patch.createFamily));
  if (patch.createGuests !== undefined) await setConfigValue(FAMILY_DEFAULT_CREATE_GUESTS_KEY, String(patch.createGuests));
  if (patch.grantGuestRequests !== undefined) await setConfigValue(FAMILY_DEFAULT_GRANT_GUEST_REQUESTS_KEY, String(patch.grantGuestRequests));
  return getCreationDefaults();
}

type RightsRow = { userId: string; createFamily: string; createGuests: string; grantGuestRequests?: string | null };

function rightsOf(row: RightsRow | null | undefined): FamilyCreationRights {
  if (!row) return { ...FAMILY_DEFAULT_CREATION_RIGHTS };
  return {
    createFamily: creationRightValue(row.createFamily),
    createGuests: creationRightValue(row.createGuests),
    grantGuestRequests: creationRightValue(row.grantGuestRequests),
  };
}

export async function accountCreationRights(userId: string): Promise<FamilyCreationRights> {
  return rightsOf(await getPrisma().familyAccountRights.findUnique({ where: { userId: fold(userId) } }));
}

export async function setAccountCreationRights(userId: string, patch: SetAccountFamilyRightsBody): Promise<FamilyCreationRights> {
  const next = { ...(await accountCreationRights(userId)), ...patch };
  const data = { createFamily: next.createFamily, createGuests: next.createGuests, grantGuestRequests: next.grantGuestRequests ?? "inherit" };
  await getPrisma().familyAccountRights.upsert({ where: { userId: fold(userId) }, create: { userId: fold(userId), ...data }, update: data });
  return next;
}

/** Administrateur Jellyfin ? null : Jellyfin muet, ou compte inconnu. */
export async function isJellyfinAdministrator(userId: string): Promise<boolean | null> {
  const users = await getJellyfinUsers();
  const user = users?.find((entry) => fold(entry.id) === fold(userId));
  return user ? user.isAdministrator : null;
}

/** Ce que ce compte peut créer maintenant, tout compris. */
export async function creationAllowedFor(userId: string): Promise<FamilyCreationAllowed> {
  const [rights, admin] = await Promise.all([accountCreationRights(userId), isJellyfinAdministrator(userId)]);
  return resolveFamilyCreation({
    rights,
    defaults: getCreationDefaults(),
    switches: getFamilySwitches(),
    isAdministrator: admin === true,
    requestExtension: hasRequestExtension(),
  });
}

/** Le même calcul pour plusieurs comptes (la gestion des profils d'une TV), en deux lectures. */
export async function creationAllowedForMany(userIds: readonly string[]): Promise<Map<string, FamilyCreationAllowed>> {
  const keys = [...new Set(userIds.map(fold))];
  const [rows, users] = await Promise.all([
    keys.length ? getPrisma().familyAccountRights.findMany({ where: { userId: { in: keys } } }) : Promise.resolve([]),
    getJellyfinUsers(),
  ]);
  const byId = new Map(rows.map((row) => [row.userId, row]));
  const admins = new Set((users ?? []).filter((user) => user.isAdministrator).map((user) => fold(user.id)));
  const defaults = getCreationDefaults();
  const switches = getFamilySwitches();
  const requestExtension = hasRequestExtension();
  return new Map(
    keys.map((key) => [
      key,
      resolveFamilyCreation({ rights: rightsOf(byId.get(key)), defaults, switches, isAdministrator: admins.has(key), requestExtension }),
    ]),
  );
}

/**
 * La garde d'une création : fonder une famille (`founding` : le compte n'en a pas
 * encore) et/ou créer un invité. Les interrupteurs se jugent avant, avec leurs
 * propres codes (`requireFamilies`, `requireGuests`).
 */
export async function requireCreation(userId: string, need: { founding: boolean; guest: boolean }): Promise<void> {
  const allowed = await creationAllowedFor(userId);
  if (need.guest && !allowed.createGuests) {
    throw new FamilyFailure("family.create_guests_denied", "L'administrateur ne permet pas à ce compte de créer des profils invités");
  }
  if (need.founding && !allowed.createFamily) {
    throw new FamilyFailure("family.create_family_denied", "L'administrateur ne permet pas à ce compte de créer une famille");
  }
}
