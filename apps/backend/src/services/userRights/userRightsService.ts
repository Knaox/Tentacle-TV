import { jellyfinAdminFetch, type JellyfinResult } from "../jellyfinAdminFetch";
import { isFamilyGuest } from "../family/familyGuestMarkers";
import { invalidateJellyfinUsers } from "../watchTogether/usersCache";
import { USER_RIGHTS_FIELDS, type UserRightsDto, type UserRightsKey, type UserRightsPatch } from "../../userRights/userRightsContract";
import { normalizeJellyfinId, parseUserRightsPatch, patchAgainstOptions } from "../../userRights/userRightsPatch";
import { applyRightsPatch, rightsFromPolicy, unappliedKeys, type JellyfinPolicy } from "./policyMapping";
import { notePolicyWritten } from "./policyWritten";
import { UserRightsFailure } from "./userRightsFailure";
import { getUserRightsOptions } from "./userRightsOptions";

/**
 * Les droits d'un compte, lus et écrits dans SA politique Jellyfin
 * (docs/DROITS-UTILISATEURS.md § 3). Jellyfin fait foi : relire la politique
 * complète, n'en changer que les champs du correctif, la réécrire, la RELIRE et
 * rendre l'état réel. Aucune copie gardée.
 *
 * Refus : un invité de la Famille ne se règle pas ici (`family_guest`) ; un
 * administrateur ne se retire ni l'administration ni l'accès (`self_lockout`) ; le
 * dernier administrateur actif ne perd ni l'un ni l'autre (`last_admin`).
 */

interface JellyfinUserDto {
  Id?: string;
  Name?: string;
  Policy?: JellyfinPolicy;
}

const GUID = /^[0-9a-f]{32}$/;

function failureOf(result: JellyfinResult<unknown>): UserRightsFailure {
  if (!result.ok && result.status === 404) return new UserRightsFailure("unknown_user");
  if (!result.ok && (result.failure === "unreachable" || result.failure === "not-configured")) return new UserRightsFailure("jellyfin_unreachable");
  return new UserRightsFailure("jellyfin_refused");
}

/** Un identifiant de compte bien formé (sans tirets, minuscules), sinon `unknown_user`. */
export function userIdOf(raw: unknown): string {
  const id = typeof raw === "string" ? normalizeJellyfinId(raw) : "";
  if (!GUID.test(id)) throw new UserRightsFailure("unknown_user");
  return id;
}

async function fetchUser(userId: string): Promise<JellyfinUserDto & { Policy: JellyfinPolicy }> {
  const result = await jellyfinAdminFetch<JellyfinUserDto>(`/Users/${userId}`);
  if (!result.ok) throw failureOf(result);
  if (!result.data?.Policy || typeof result.data.Policy !== "object") throw new UserRightsFailure("jellyfin_refused");
  return result.data as JellyfinUserDto & { Policy: JellyfinPolicy };
}

function toDto(userId: string, user: JellyfinUserDto & { Policy: JellyfinPolicy }): UserRightsDto {
  return { userId, name: user.Name ?? "", rights: rightsFromPolicy(user.Policy), readAt: new Date().toISOString() };
}

async function refuseGuest(userId: string): Promise<void> {
  // Base muette : on ne sait pas si c'est un invité — on ne règle rien (fermé à l'échec).
  const guest = await isFamilyGuest(userId).catch(() => {
    throw new UserRightsFailure("jellyfin_unreachable");
  });
  if (guest) throw new UserRightsFailure("family_guest");
}

export async function readUserRights(rawUserId: unknown): Promise<UserRightsDto> {
  const userId = userIdOf(rawUserId);
  await refuseGuest(userId);
  return toDto(userId, await fetchUser(userId));
}

/** Retire-t-il l'administration, ou l'accès, à un administrateur actif ? */
function dropsAdmin(current: JellyfinPolicy, patch: UserRightsPatch): boolean {
  const activeAdmin = current.IsAdministrator === true && current.IsDisabled !== true;
  return activeAdmin && (patch.isAdministrator === false || patch.isDisabled === true);
}

async function otherActiveAdmins(userId: string): Promise<number> {
  const result = await jellyfinAdminFetch<JellyfinUserDto[]>("/Users");
  if (!result.ok || !Array.isArray(result.data)) throw failureOf(result);
  return result.data.filter(
    (user) => user.Id && normalizeJellyfinId(user.Id) !== userId && user.Policy?.IsAdministrator === true && user.Policy?.IsDisabled !== true,
  ).length;
}

/**
 * Applique un correctif et rend l'état RELU dans Jellyfin. `actor` : l'administrateur
 * en session personnelle (jamais une valeur au journal : des NOMS de champs).
 */
export async function updateUserRights(actor: { userId: string; username: string }, rawUserId: unknown, body: unknown): Promise<UserRightsDto> {
  const userId = userIdOf(rawUserId);
  const parsed = parseUserRightsPatch(body);
  if (!parsed.ok) throw new UserRightsFailure("invalid_value", parsed.fields);
  const patch = parsed.patch;
  await refuseGuest(userId);

  const needsOptions = (Object.keys(patch) as UserRightsKey[]).some(
    (key) => USER_RIGHTS_FIELDS[key].kind === "folderList" || key === "maxParentalRating" || key === "maxParentalSubRating",
  );
  if (needsOptions) {
    const refused = patchAgainstOptions(patch, await getUserRightsOptions());
    if (refused.length > 0) throw new UserRightsFailure("invalid_value", refused);
  }

  const user = await fetchUser(userId);
  if (dropsAdmin(user.Policy, patch)) {
    if (normalizeJellyfinId(actor.userId) === userId) throw new UserRightsFailure("self_lockout");
    if ((await otherActiveAdmins(userId)) === 0) throw new UserRightsFailure("last_admin");
  }

  const written = await jellyfinAdminFetch(`/Users/${userId}/Policy`, {
    method: "POST",
    body: applyRightsPatch(userId, user.Policy, patch),
    expectEmpty: true,
    timeoutMs: 8_000,
  });
  // Écrite ou non, la politique a pu changer : rien de gardé ne doit survivre.
  await notePolicyWritten(userId);
  if (!written.ok) throw failureOf(written);
  invalidateJellyfinUsers();

  const dto = toDto(userId, await fetchUser(userId));
  const keys = Object.keys(patch);
  const unapplied = unappliedKeys(patch, dto.rights);
  console.log(
    `[user-rights] ${actor.username} → ${dto.name || userId} : ${keys.join(", ")}` +
      (unapplied.length ? ` (non retenus par Jellyfin : ${unapplied.join(", ")})` : ""),
  );
  return dto;
}
