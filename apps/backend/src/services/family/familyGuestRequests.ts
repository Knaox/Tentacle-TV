import { getPrisma } from "../db";
import { guestRequestState, type FamilyGuestRights } from "../../family/familyContract";
import { creationAllowedFor, creationAllowedForMany } from "./familyCreationRights";
import { FamilyFailure } from "./familyErrors";
import { familyUpdate } from "./familyNotify";
import { fold, type MemberRow } from "./familyStore";

/**
 * « Les invités peuvent demander des films » — ce que l'administration décide (1.30.0,
 * `family.guestRequestsAdmin`, docs/DROITS-UTILISATEURS.md § 9.8). Deux niveaux :
 * l'interrupteur `guestRequests` (`familyConfig.ts`, COUPÉ tant qu'on ne l'a pas allumé,
 * mise à jour comprise) et le droit de compte `grantGuestRequests`
 * (`familyCreationRights.ts`, défaut NON, un administrateur Jellyfin l'a d'office).
 *
 * La case d'un invité appartient au compte qui l'a cochée (`requestTitlesGrantedBy` ;
 * ligne d'avant : son créateur, sinon le propriétaire). Que ce compte perde le droit, ou
 * que l'interrupteur se coupe, et la case est SUSPENDUE : gardée en base, sans effet —
 * `guestExtensionAccess` refuse les extensions à l'invité, les clients la lisent
 * `requestTitles: false, suspended: true`. Le droit revenu, elle revit telle quelle.
 */

type GrantRow = Pick<MemberRow, "kind" | "userId" | "createdBy" | "canRequestTitles"> & { requestTitlesGrantedBy?: string | null };

/** Le compte dont le droit tient la case de cet invité. */
export function granterOf(row: GrantRow, ownerUserId: string): string {
  return row.requestTitlesGrantedBy ?? row.createdBy ?? ownerUserId;
}

/** « Peut demander » en vigueur pour chaque invité de ces lignes (deux lectures au plus). */
export async function guestRightsOf(rows: readonly GrantRow[], ownerUserId: string): Promise<Map<string, FamilyGuestRights>> {
  const guests = rows.filter((row) => row.kind === "guest");
  const checked = guests.filter((row) => row.canRequestTitles === true);
  const allowed = checked.length ? await creationAllowedForMany(checked.map((row) => granterOf(row, ownerUserId))) : new Map();
  return new Map(
    guests.map((row) => [
      row.userId,
      guestRequestState(row.canRequestTitles === true, allowed.get(fold(granterOf(row, ownerUserId)))?.grantGuestRequests === true),
    ]),
  );
}

/** Un invité seul — les routes d'extension, à chaque requête. */
export async function guestMayRequest(row: GrantRow & { familyId: string }): Promise<boolean> {
  if (row.canRequestTitles !== true) return false;
  const family = await getPrisma().family.findUnique({ where: { id: row.familyId }, select: { ownerUserId: true } });
  if (!family) return false;
  return (await creationAllowedFor(granterOf(row, family.ownerUserId))).grantGuestRequests === true;
}

/** Cocher « peut demander » exige le droit du compte qui AGIT ; décocher, jamais. */
export async function requireGuestRequestGrant(actorUserId: string): Promise<void> {
  if ((await creationAllowedFor(actorUserId)).grantGuestRequests !== true) {
    throw new FamilyFailure("family.guest_requests_denied", "L'administrateur ne permet pas à ce compte d'autoriser ses invités à demander des films");
  }
}

/**
 * Ce que l'administration permet a changé pour tous (interrupteur, défaut) : chaque compte
 * d'une famille — invités compris, leur TV relit son droit — relit la Famille.
 */
export async function notifyAllFamilies(): Promise<void> {
  const rows = await getPrisma().familyMember.findMany({ select: { userId: true } });
  familyUpdate(rows.map((row) => row.userId), "family");
}
