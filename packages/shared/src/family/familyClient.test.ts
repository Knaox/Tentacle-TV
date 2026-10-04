import { describe, expect, it } from "vitest";
import { FAMILY_PROFILE_COLORS, type FamilyOverviewDto, type FamilyProfileDto, type IncomingInvitationDto, type OwnedFamilyDto } from "./familyContract";
import {
  familyPosterRequestOf,
  FAMILY_PROFILE_COLOR_STOPS,
  isFamilyAvailable,
  ownedCounts,
  ownerActions,
  pickPosterInvitation,
  profileColorStops,
} from "./familyClient";

const NOW = Date.parse("2026-10-04T12:00:00Z");
const HOUR = 3_600_000;
const iso = (ms: number) => new Date(ms).toISOString();

function profile(kind: FamilyProfileDto["kind"], userId: string): FamilyProfileDto {
  return { userId, kind, name: userId, color: "violet", hasPin: false, imageTag: null, since: kind === "owner" ? null : iso(NOW) };
}

function owned(members: number, guests: number, pending: number): OwnedFamilyDto {
  return {
    id: "f1",
    createdAt: iso(NOW),
    profiles: [
      profile("owner", "owner"),
      ...Array.from({ length: members }, (_, i) => profile("member", `m${i}`)),
      ...Array.from({ length: guests }, (_, i) => profile("guest", `g${i}`)),
    ],
    pendingInvitations: Array.from({ length: pending }, (_, i) => ({
      id: `i${i}`, inviteeUserId: `u${i}`, inviteeName: `U${i}`, createdAt: iso(NOW), expiresAt: iso(NOW + 24 * HOUR),
    })),
  };
}

function overview(patch: Partial<FamilyOverviewDto> = {}, account: Partial<FamilyOverviewDto["account"]> = {}): FamilyOverviewDto {
  return {
    v: 1,
    switches: { families: true, guests: true },
    account: { canOwn: true, canJoin: true, reviewAccount: false, hasPin: false, personalSession: true, ...account },
    owned: null,
    memberships: [],
    incoming: [],
    limits: { maxProfiles: 6, maxGuests: 3 },
    ...patch,
  };
}

function invitation(id: string, patch: Partial<IncomingInvitationDto> = {}): IncomingInvitationDto {
  return {
    id, familyId: "f", ownerUserId: "o", ownerName: "Damien",
    createdAt: iso(NOW - HOUR), expiresAt: iso(NOW + 24 * HOUR), snoozedUntil: null, ...patch,
  };
}

describe("isFamilyAvailable", () => {
  it("rien sans la capacité du serveur (serveur d'avant), ni hors ligne", () => {
    expect(isFamilyAvailable(undefined, false)).toBe(false);
    expect(isFamilyAvailable({ v: 1, enabled: true, guests: true }, true)).toBe(false);
  });

  it("la page reste là quand l'administrateur coupe les familles : on peut encore réduire", () => {
    expect(isFamilyAvailable({ v: 1, enabled: false, guests: false }, false)).toBe(true);
  });
});

describe("ownedCounts", () => {
  it("compte le propriétaire et les invitations en attente, qui réservent leur place", () => {
    expect(ownedCounts(null)).toEqual({ profiles: 1, guests: 0, members: 0, pending: 0 });
    expect(ownedCounts(owned(2, 1, 1))).toEqual({ profiles: 5, guests: 1, members: 2, pending: 1 });
  });
});

describe("ownerActions", () => {
  it("permet d'inviter et de créer un invité à qui n'a pas encore de famille", () => {
    expect(ownerActions(overview())).toEqual({ invite: null, addGuest: null });
  });

  it("dit la famille complète à six profils, invitations en attente comprises", () => {
    expect(ownerActions(overview({ owned: owned(3, 1, 1) }))).toEqual({ invite: "family.full", addGuest: "family.full" });
  });

  it("refuse un quatrième invité mais laisse inviter un compte", () => {
    expect(ownerActions(overview({ owned: owned(0, 3, 0) }))).toEqual({ invite: null, addGuest: "family.guests_full" });
  });

  it("suit les interrupteurs de l'administration", () => {
    expect(ownerActions(overview({ switches: { families: true, guests: false } }))).toEqual({
      invite: null,
      addGuest: "family.guests_disabled",
    });
    expect(ownerActions(overview({ switches: { families: false, guests: true } }))).toEqual({
      invite: "family.disabled",
      addGuest: "family.disabled",
    });
  });

  it("le compte de démonstration, un invité ou « voir en tant que » n'ajoutent rien", () => {
    expect(ownerActions(overview({}, { reviewAccount: true })).invite).toBe("family.review_account");
    expect(ownerActions(overview({}, { canOwn: false })).addGuest).toBe("family.guest_account");
    expect(ownerActions(overview({}, { personalSession: false })).invite).toBe("family.personal_session_required");
  });
});

describe("pickPosterInvitation", () => {
  const none = new Set<string>();

  it("montre la plus ancienne invitation en attente", () => {
    const list = [invitation("b", { createdAt: iso(NOW - HOUR) }), invitation("a", { createdAt: iso(NOW - 2 * HOUR) })];
    expect(pickPosterInvitation(list, { now: NOW, dismissed: none, requestedId: null })?.id).toBe("a");
  });

  it("se tait pour une invitation remise à plus tard, jusqu'au terme", () => {
    const later = invitation("a", { snoozedUntil: iso(NOW + HOUR) });
    expect(pickPosterInvitation([later], { now: NOW, dismissed: none, requestedId: null })).toBeNull();
    expect(pickPosterInvitation([later], { now: NOW + 2 * HOUR, dismissed: none, requestedId: null })?.id).toBe("a");
  });

  it("ne revient pas sur une invitation écartée pendant la session, ni sur une échue", () => {
    expect(pickPosterInvitation([invitation("a")], { now: NOW, dismissed: new Set(["a"]), requestedId: null })).toBeNull();
    const expired = invitation("a", { expiresAt: iso(NOW - 1) });
    expect(pickPosterInvitation([expired], { now: NOW, dismissed: none, requestedId: null })).toBeNull();
  });

  it("la cloche rouvre une invitation même remise à plus tard ; une invitation disparue ne rouvre rien", () => {
    const later = invitation("a", { snoozedUntil: iso(NOW + HOUR) });
    expect(pickPosterInvitation([later], { now: NOW, dismissed: new Set(["a"]), requestedId: "a" })?.id).toBe("a");
    expect(pickPosterInvitation([later], { now: NOW, dismissed: none, requestedId: "gone" })).toBeNull();
  });
});

describe("familyPosterRequestOf", () => {
  it("une invitation reçue ouvre SON affiche ; le reste mène à la page", () => {
    expect(familyPosterRequestOf({ type: "family_invite", refId: "inv" })).toBe("inv");
    expect(familyPosterRequestOf({ type: "family_invite", refId: null })).toBeNull();
    expect(familyPosterRequestOf({ type: "family_invite_accepted", refId: "inv" })).toBeNull();
    expect(familyPosterRequestOf({ type: "ticket_reply", refId: "t" })).toBeNull();
  });
});

describe("couleurs de profil", () => {
  it("chaque couleur du contrat a ses deux teintes ; une inconnue prend le violet", () => {
    for (const color of FAMILY_PROFILE_COLORS) expect(FAMILY_PROFILE_COLOR_STOPS[color]).toHaveLength(2);
    expect(profileColorStops("mauve" as never)).toEqual(FAMILY_PROFILE_COLOR_STOPS.violet);
  });
});
