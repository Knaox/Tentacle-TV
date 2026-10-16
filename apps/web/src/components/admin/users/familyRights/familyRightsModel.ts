import type { AccountFamilyRightsDto, FamilyCreationRightValue } from "@tentacle-tv/shared";

/**
 * Ce que dit le panneau « Famille » d'un compte — règles pures, sans React. Le
 * serveur a déjà tout décidé (`allowed`) ; on ne fait que choisir les mots.
 */

export type CreationRightKey = "createFamily" | "createGuests" | "grantGuestRequests";

/** Le réglage du compte pour ce droit (`grantGuestRequests` absent d'un serveur d'avant : `inherit`). */
export function rightValue(dto: AccountFamilyRightsDto, key: CreationRightKey): FamilyCreationRightValue {
  return dto.rights[key] ?? "inherit";
}

/** Ce qui vaut pour ce droit, tout compris. */
export function isAllowed(dto: AccountFamilyRightsDto, key: CreationRightKey): boolean {
  return dto.allowed[key] === true;
}

/** Pourquoi la valeur en vigueur est ce qu'elle est, au-delà du réglage : clé i18n `familyWeb:accountRights.*`, ou null. */
export function creationNote(dto: AccountFamilyRightsDto, key: CreationRightKey): "adminAlways" | "switchedOff" | "switchedOffRequests" | null {
  if (dto.isAdministrator === true && isAllowed(dto, key)) return "adminAlways";
  const value = rightValue(dto, key);
  const wouldAllow = value === "allow" || (value === "inherit" && inheritValue(dto, key));
  if (isAllowed(dto, key) || !(wouldAllow || dto.isAdministrator === true)) return null;
  return key === "grantGuestRequests" ? "switchedOffRequests" : "switchedOff";
}

/** La place du compte dans une famille : clé i18n `familyWeb:accountRights.*` et son propriétaire, ou null. */
export function familyPlace(dto: AccountFamilyRightsDto): { key: "owner" | "member" | "parent" | "guest"; owner: string } | null {
  if (!dto.family) return null;
  const key = dto.family.role === "member" && dto.family.parent ? "parent" : dto.family.role;
  return { key, owner: dto.family.ownerName };
}

/** Le défaut à rappeler dans le choix « Par défaut (…) ». */
export function inheritValue(dto: AccountFamilyRightsDto, key: CreationRightKey): boolean {
  return dto.defaults[key] === true;
}

/** Un invité ne se règle pas : le panneau le dit, sans choix. */
export function isEditable(dto: AccountFamilyRightsDto): boolean {
  return dto.family?.role !== "guest";
}

export const CREATION_RIGHT_KEYS: readonly CreationRightKey[] = ["createFamily", "createGuests"];

/**
 * Les droits que la fiche montre : les deux droits de création, puis — serveur
 * `family.guestRequestsAdmin` ET une extension qui sait demander un titre (`requestExtension`) —
 * « Autoriser ses invités à demander des films ».
 */
export function rightKeysOf(dto: AccountFamilyRightsDto, guestRequestsAdmin: boolean): readonly CreationRightKey[] {
  return guestRequestsAdmin && dto.requestExtension === true ? [...CREATION_RIGHT_KEYS, "grantGuestRequests"] : CREATION_RIGHT_KEYS;
}

/** Un fragment du résumé de la rubrique : une clé `familyWeb:accountRights.*` et ses valeurs. */
export interface SummaryPart {
  key: string;
  values?: Record<string, string>;
  /** Une valeur elle-même à traduire (`summaryAllowed` / `summaryDenied`). */
  valueKey?: string;
}

/**
 * La rubrique repliée en une ligne, comme celles de la fiche des droits : ce qui vaut pour
 * chaque droit de création, puis « restreint par la famille de … » — ou, pour un invité, sa
 * famille seulement (il ne crée rien).
 */
export function familyRightsSummary(dto: AccountFamilyRightsDto, guestRequestsAdmin = false): SummaryPart[] {
  if (dto.family?.role === "guest") return [{ key: "summaryGuest", values: { owner: dto.family.ownerName } }];
  const parts: SummaryPart[] = [
    { key: "summaryFamily", valueKey: dto.allowed.createFamily ? "summaryAllowed" : "summaryDenied" },
    { key: "summaryGuests", valueKey: dto.allowed.createGuests ? "summaryAllowed" : "summaryDenied" },
  ];
  if (rightKeysOf(dto, guestRequestsAdmin).includes("grantGuestRequests")) {
    parts.push({ key: "summaryGuestRequests", valueKey: isAllowed(dto, "grantGuestRequests") ? "summaryAllowed" : "summaryDenied" });
  }
  if (dto.restrictedBy) parts.push({ key: "summaryRestricted", values: { owner: dto.restrictedBy.ownerName } });
  return parts;
}

export type { FamilyCreationRightValue };
