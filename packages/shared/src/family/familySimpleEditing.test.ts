import { describe, expect, it } from "vitest";
import type { ServerCapability } from "../serverCapabilities/serverCapabilities";
import type { FamilyDto, FamilyOverviewDto, FamilyProfileDto, FamilyRole } from "./familyContract";
import { GUEST_PARENTAL_NONE } from "./familyParental";
import { familyRightsOf } from "./familyRights";
import { familySimpleEditing } from "./familySimpleEditing";

/**
 * Ce qu'un écran simple (mobile, tablette) règle sur un profil : les droits de
 * la Famille qui tiennent dans un interrupteur, une liste ou un choix — pour
 * ceux que le bureau laisse régler à ce compte, et pas plus.
 */

const OWNER = "owner-id";
const ANA = "ana-id";
const ALL: ReadonlySet<ServerCapability> = new Set([
  "family.parentalControls", "family.memberParental", "family.libraryLimits", "family.roles",
] as ServerCapability[]);

function profile(kind: FamilyProfileDto["kind"], userId: string, extra: Partial<FamilyProfileDto> = {}): FamilyProfileDto {
  return {
    userId, kind, name: userId, color: "violet", hasPin: false, imageTag: null,
    since: kind === "owner" ? null : "2026-10-04T00:00:00Z", createdBy: kind === "guest" ? OWNER : null, createdByName: null,
    rights: kind === "member" ? { createGuests: false } : null, guestRights: kind === "guest" ? { requestTitles: false } : null,
    ...extra,
  };
}

const KID = profile("member", ANA, { parental: { ...GUEST_PARENTAL_NONE, maxParentalRating: 6 }, parentalCeiling: null });
const GUEST = profile("guest", "lea", { parental: GUEST_PARENTAL_NONE, parentalCeiling: null });
const GUEST_HIDDEN = profile("guest", "zoe");

function overview(role: FamilyRole, personal = true): FamilyOverviewDto {
  const switches = { families: true, guests: true, guestRequests: true };
  const family: FamilyDto = {
    id: "f", role, owner: { userId: OWNER, name: "Damien" }, profiles: [profile("owner", OWNER), KID, GUEST], pendingInvitations: [],
    rights: familyRightsOf(role, { createGuests: false }, switches, { creation: { createFamily: true, createGuests: true } }),
    createdAt: "2026-10-01T00:00:00Z", since: role === "owner" ? null : "2026-10-02T00:00:00Z",
  };
  return {
    v: 2, switches, family, owned: null, memberships: [], incoming: [], limits: { maxProfiles: 6, maxGuests: 3 },
    account: { canOwn: true, canJoin: false, reviewAccount: false, hasPin: false, personalSession: personal, creation: { createFamily: true, createGuests: true, grantGuestRequests: true } },
  } as FamilyOverviewDto;
}

describe("familySimpleEditing", () => {
  it("le propriétaire règle l'âge et les bibliothèques d'un invité, et « peut demander »", () => {
    const edit = familySimpleEditing(overview("owner"), GUEST, OWNER, ALL, { guestRequests: true });
    expect(edit).toMatchObject({ age: true, libraries: true, requestTitles: true, any: true, moreElsewhere: true });
  });

  it("le propriétaire règle un membre mineur : âge, bibliothèques, créer des invités, et le rôle de parent (bloqué tant qu'il est restreint)", () => {
    const edit = familySimpleEditing(overview("owner"), KID, OWNER, ALL);
    expect(edit).toMatchObject({ age: true, libraries: true, createGuests: true, parent: true, parentBlocked: true });
  });

  it("un invité dont le serveur ne rend pas le contrôle : rien de parental ici", () => {
    const edit = familySimpleEditing(overview("owner"), GUEST_HIDDEN, OWNER, ALL);
    expect(edit).toMatchObject({ age: false, libraries: false });
  });

  it("serveur d'avant (sans les capacités) : ni âge ni bibliothèques", () => {
    expect(familySimpleEditing(overview("owner"), GUEST, OWNER, new Set())).toMatchObject({ age: false, libraries: false });
  });

  it("un simple membre ne règle rien d'un autre membre ; personne ne règle le propriétaire", () => {
    expect(familySimpleEditing(overview("member"), KID, "autre", ALL).any).toBe(false);
    expect(familySimpleEditing(overview("owner"), profile("owner", OWNER), OWNER, ALL).any).toBe(false);
  });

  it("hors session personnelle (et sans gestion ouverte) : rien", () => {
    expect(familySimpleEditing(overview("owner", false), GUEST, OWNER, ALL, { guestRequests: true }).any).toBe(false);
  });
});
