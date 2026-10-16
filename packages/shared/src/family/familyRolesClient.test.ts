import { describe, expect, it } from "vitest";
import type { FamilyDto, FamilyOverviewDto, FamilyProfileDto, FamilyRole } from "./familyContract";
import { GUEST_PARENTAL_NONE } from "./familyParental";
import { familyRightsOf } from "./familyRights";
import { familyActions, profileActions, sessionManages } from "./familyClient";
import { hasParentalControl, isFamilyParent, profileRoleActions } from "./familyRolesClient";

/**
 * Parents, membres mineurs et droits de création (1.30.0), vus par celui qui
 * regarde : le propriétaire nomme les parents, le propriétaire et les parents
 * règlent le contrôle parental des membres que le serveur rend restreignables,
 * et l'administration dit ce qu'un compte peut créer.
 */

const OWNER = "owner-id";
const ANA = "ana-id";
const PAUL = "paul-id";

function profile(kind: FamilyProfileDto["kind"], userId: string, extra: Partial<FamilyProfileDto> = {}): FamilyProfileDto {
  return {
    userId, kind, name: userId, color: "violet", hasPin: false, imageTag: null,
    since: kind === "owner" ? null : "2026-10-04T00:00:00Z", createdBy: kind === "guest" ? ANA : null, createdByName: null,
    rights: kind === "member" ? { createGuests: false } : null, guestRights: kind === "guest" ? { requestTitles: false } : null,
    ...extra,
  };
}

const KID = profile("member", ANA, { parental: { ...GUEST_PARENTAL_NONE, maxParentalRating: 6 }, parentalCeiling: null });
const PARENT = profile("member", PAUL, { parent: true });
const GUEST = profile("guest", "lea");

function overview(role: FamilyRole | null, options: { parent?: boolean; creation?: { createFamily: boolean; createGuests: boolean } } = {}): FamilyOverviewDto {
  const switches = { families: true, guests: true };
  const family: FamilyDto | null = role && {
    id: "f", role, parent: options.parent, owner: { userId: OWNER, name: "Damien" },
    profiles: [profile("owner", OWNER), KID, PARENT, GUEST], pendingInvitations: [],
    rights: familyRightsOf(role, { createGuests: false }, switches, { parent: options.parent, creation: options.creation }),
    createdAt: "2026-10-01T00:00:00Z", since: role === "owner" ? null : "2026-10-02T00:00:00Z",
  };
  return {
    v: 2, switches, family, owned: null, memberships: [], incoming: [], limits: { maxProfiles: 6, maxGuests: 3 },
    account: {
      canOwn: role !== "member", canJoin: role === null, reviewAccount: false, hasPin: false, personalSession: true,
      ...(options.creation && { creation: options.creation }),
    },
  };
}

describe("profileRoleActions", () => {
  it("le propriétaire nomme un parent ; un membre restreint ne le devient qu'une fois son contrôle retiré", () => {
    const o = overview("owner");
    expect(profileRoleActions(o, PARENT, OWNER)).toEqual({ role: true, roleBlockedByParental: false, memberParental: false });
    expect(profileRoleActions(o, KID, OWNER)).toEqual({ role: true, roleBlockedByParental: true, memberParental: true });
  });

  it("un parent règle le contrôle parental d'un membre mineur, jamais les rôles", () => {
    const o = overview("member", { parent: true });
    expect(profileRoleActions(o, KID, PAUL)).toEqual({ role: false, roleBlockedByParental: false, memberParental: true });
    expect(profileRoleActions(o, PARENT, PAUL)).toEqual({ role: false, roleBlockedByParental: false, memberParental: false });
  });

  it("un simple membre ne règle rien ; un membre sans état rendu (administrateur, serveur d'avant) non plus", () => {
    expect(profileRoleActions(overview("member"), KID, PAUL)).toEqual({ role: false, roleBlockedByParental: false, memberParental: false });
    const bare = profile("member", "bob-id");
    expect(profileRoleActions(overview("owner"), bare, OWNER).memberParental).toBe(false);
  });

  it("rien sur un invité, sur le propriétaire ni hors session personnelle", () => {
    const o = overview("owner");
    expect(profileRoleActions(o, GUEST, OWNER).role).toBe(false);
    expect(profileRoleActions(o, profile("owner", OWNER), OWNER).role).toBe(false);
    const tv = { ...o, account: { ...o.account, personalSession: false } };
    expect(profileRoleActions(tv, KID, OWNER).memberParental).toBe(false);
  });

  it("un profil qui gère (1.30.0, `managing`) : les mêmes gestes qu'en session personnelle", () => {
    const o = overview("owner");
    const managing = { ...o, account: { ...o.account, personalSession: false, managing: true } };
    expect(profileRoleActions(managing, KID, OWNER)).toEqual(profileRoleActions(o, KID, OWNER));
    expect(sessionManages(managing.account)).toBe(true);
    expect(sessionManages({ personalSession: false })).toBe(false);
  });

  it("lit le parent et le contrôle tels que le serveur les rend", () => {
    expect(isFamilyParent(PARENT)).toBe(true);
    expect(isFamilyParent(profile("member", "x"))).toBe(false);
    expect(hasParentalControl(KID)).toBe(true);
    expect(hasParentalControl(profile("member", "x", { parental: GUEST_PARENTAL_NONE }))).toBe(false);
  });
});

describe("un parent règle les invités comme le propriétaire", () => {
  it("PIN, suppression et « peut demander » sur TOUS les invités", () => {
    const o = overview("member", { parent: true });
    expect(profileActions(o, GUEST, PAUL, { guestRequests: true })).toEqual({ pin: true, remove: true, right: "requestTitles" });
  });
});

describe("familyActions — les droits de création de l'administration", () => {
  it("un compte sans famille et sans droit de fonder : ni invitation ni invité, dit en clair", () => {
    const o = overview(null, { creation: { createFamily: false, createGuests: true } });
    expect(familyActions(o)).toEqual({ invite: "family.create_family_denied", addGuest: "family.create_family_denied" });
  });

  it("sans le droit de créer des invités : le refus de l'administration passe avant celui du propriétaire", () => {
    expect(familyActions(overview("owner", { creation: { createFamily: false, createGuests: false } })).addGuest).toBe("family.create_guests_denied");
    expect(familyActions(overview("member", { creation: { createFamily: false, createGuests: false } })).addGuest).toBe("family.create_guests_denied");
    expect(familyActions(overview("member", { creation: { createFamily: false, createGuests: true } })).addGuest).toBe("family.guest_right_required");
  });

  it("une famille déjà fondée invite encore, même sans le droit de fonder ; un parent crée d'office", () => {
    const o = overview("owner", { creation: { createFamily: false, createGuests: true } });
    expect(familyActions(o)).toEqual({ invite: null, addGuest: null });
    expect(familyActions(overview("member", { parent: true, creation: { createFamily: false, createGuests: true } })).addGuest).toBeNull();
  });

  it("un serveur d'avant (aucun `creation`) : comme avant", () => {
    expect(familyActions(overview(null))).toEqual({ invite: null, addGuest: null });
  });
});
