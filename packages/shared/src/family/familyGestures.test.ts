import { describe, expect, it } from "vitest";
import type { FamilyDto, FamilyOverviewDto, IncomingInvitationDto } from "./familyContract";
import { familyEntryShown, familyGestureExists, familyGrowth } from "./familyGestures";

/**
 * Les droits de la Famille du SERVEUR, appliqués à ce qui se MONTRE (retours de l'alpha, 21/10) :
 * un droit coupé ne laisse ni bouton grisé, ni appel à créer, ni entrée de réglages.
 */
const NOW = Date.parse("2026-10-21T12:00:00Z");
const iso = (ms: number) => new Date(ms).toISOString();

function family(role: FamilyDto["role"], createGuests = false): FamilyDto {
  return {
    id: "f1", createdAt: iso(NOW), role, owner: { userId: "owner", name: "Damien" }, since: null,
    profiles: [{ userId: "owner", kind: "owner", name: "Damien", color: "violet", hasPin: false, imageTag: null, since: null, createdBy: null, createdByName: null, rights: null }],
    pendingInvitations: [],
    rights: role === "owner" ? { manageMembers: true, createGuests: true, manageGuests: "all" } : { manageMembers: false, createGuests, manageGuests: "own" },
  };
}

function overview(patch: Partial<FamilyOverviewDto> = {}, account: Partial<FamilyOverviewDto["account"]> = {}): FamilyOverviewDto {
  return {
    v: 2,
    switches: { families: true, guests: true },
    account: { canOwn: true, canJoin: true, reviewAccount: false, hasPin: false, personalSession: true, ...account },
    family: null, owned: null, memberships: [], incoming: [], limits: { maxProfiles: 6, maxGuests: 3 },
    ...patch,
  };
}

const invitation = (expiresAt: number): IncomingInvitationDto => ({
  id: "i1", familyId: "f", ownerUserId: "o", ownerName: "Léa", createdAt: iso(NOW - 1000), expiresAt: iso(expiresAt), snoozedUntil: null,
});

describe("familyGestureExists", () => {
  it("permis, ou refusé pour l'instant (famille pleine, quota) : le geste existe ; refusé par l'administration ou le rôle : non", () => {
    expect(familyGestureExists(null)).toBe(true);
    for (const passing of ["family.full", "family.guests_full", "family.invite_quota"] as const) expect(familyGestureExists(passing)).toBe(true);
    for (const absent of ["family.disabled", "family.guests_disabled", "family.create_family_denied", "family.create_guests_denied", "family.guest_right_required", "family.not_owner"] as const) {
      expect(familyGestureExists(absent)).toBe(false);
    }
  });
});

describe("familyGrowth — un test par droit", () => {
  it("tout permis : inviter et ajouter un invité", () => {
    expect(familyGrowth(overview())).toEqual({ invite: true, addGuest: true });
    expect(familyGrowth(overview({ family: family("owner") }))).toEqual({ invite: true, addGuest: true });
  });

  it("« Familles » coupées par l'administration : rien, même pour le propriétaire", () => {
    expect(familyGrowth(overview({ switches: { families: false, guests: true } }))).toEqual({ invite: false, addGuest: false });
    expect(familyGrowth(overview({ family: family("owner"), switches: { families: false, guests: true } }))).toEqual({ invite: false, addGuest: false });
  });

  it("fonder une famille refusé à ce compte : sans famille, rien ; propriétaire d'une famille déjà fondée, tout reste", () => {
    const denied = { creation: { createFamily: false, createGuests: true } } as Partial<FamilyOverviewDto["account"]>;
    expect(familyGrowth(overview({}, denied))).toEqual({ invite: false, addGuest: false });
    expect(familyGrowth(overview({ family: family("owner") }, denied))).toEqual({ invite: true, addGuest: true });
  });

  it("profils invités coupés, ou refusés à ce compte : « Ajouter un invité » disparaît, « Inviter » reste", () => {
    expect(familyGrowth(overview({ switches: { families: true, guests: false } }))).toEqual({ invite: true, addGuest: false });
    const denied = { creation: { createFamily: true, createGuests: false } } as Partial<FamilyOverviewDto["account"]>;
    expect(familyGrowth(overview({}, denied))).toEqual({ invite: true, addGuest: false });
  });

  it("un membre n'invite jamais ; il ajoute un invité seulement si le propriétaire le lui permet", () => {
    expect(familyGrowth(overview({ family: family("member") }))).toEqual({ invite: false, addGuest: false });
    expect(familyGrowth(overview({ family: family("member", true) }))).toEqual({ invite: false, addGuest: true });
  });

  it("le compte de démonstration, une session qui ne gère pas : rien", () => {
    expect(familyGrowth(overview({}, { reviewAccount: true }))).toEqual({ invite: false, addGuest: false });
    expect(familyGrowth(overview({ family: family("owner") }, { personalSession: false }))).toEqual({ invite: false, addGuest: false });
  });

  it("serveur qui ne déclare rien des droits de création (`creation` absent) : comme avant, tout permis", () => {
    const legacy = overview();
    expect(legacy.account.creation).toBeUndefined();
    expect(familyGrowth(legacy)).toEqual({ invite: true, addGuest: true });
  });
});

describe("familyEntryShown — l'entrée « Famille » des réglages", () => {
  const closed = { switches: { families: false, guests: false } };

  it("rien tant que la vue d'ensemble n'est pas lue ; pas de famille ici (null) : non", () => {
    expect(familyEntryShown(undefined, NOW)).toBeUndefined();
    expect(familyEntryShown(null, NOW)).toBe(false);
  });

  it("dans une famille, même coupée par l'administration : oui (quitter, retirer, dissoudre)", () => {
    expect(familyEntryShown(overview({ ...closed, family: family("member") }), NOW)).toBe(true);
  });

  it("sans famille et rien de permis : non, même avec une invitation reçue (les familles coupées, le serveur la refuserait)", () => {
    expect(familyEntryShown(overview(closed), NOW)).toBe(false);
    expect(familyEntryShown(overview({ ...closed, incoming: [invitation(NOW - 1)] }), NOW)).toBe(false);
    expect(familyEntryShown(overview({ ...closed, incoming: [invitation(NOW + 60_000)] }), NOW)).toBe(false);
  });

  it("sans famille, la fonder permis : oui", () => {
    expect(familyEntryShown(overview(), NOW)).toBe(true);
  });
});
