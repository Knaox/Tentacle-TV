import { describe, expect, it } from "vitest";
import {
  FAMILY_PROFILE_COLORS,
  type FamilyDto,
  type FamilyOverviewDto,
  type FamilyProfileDto,
  type IncomingInvitationDto,
  type OwnedFamilyDto,
} from "./familyContract";
import {
  familyActions,
  familyCounts,
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
  return {
    userId, kind, name: userId, color: "violet", hasPin: false, imageTag: null, since: kind === "owner" ? null : iso(NOW),
    createdBy: kind === "guest" ? "owner" : null, createdByName: kind === "guest" ? "owner" : null,
    rights: kind === "member" ? { createGuests: false } : null,
  };
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

/** La famille v2 vue par CE compte : propriétaire, ou membre (avec ou sans le droit de créer). */
function family(role: FamilyDto["role"], counts: { members: number; guests: number; pending: number }, createGuests = false): FamilyDto {
  const base = owned(counts.members, counts.guests, role === "owner" ? counts.pending : 0);
  return {
    ...base,
    role,
    owner: { userId: "owner", name: "owner" },
    rights: role === "owner"
      ? { manageMembers: true, createGuests: true, manageGuests: "all" }
      : { manageMembers: false, createGuests, manageGuests: "own" },
    since: role === "owner" ? null : iso(NOW),
  };
}

function overview(patch: Partial<FamilyOverviewDto> = {}, account: Partial<FamilyOverviewDto["account"]> = {}): FamilyOverviewDto {
  return {
    v: 2,
    switches: { families: true, guests: true },
    account: { canOwn: true, canJoin: true, reviewAccount: false, hasPin: false, personalSession: true, ...account },
    family: null,
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

describe("familyActions (v2)", () => {
  it("un compte sans famille crée la sienne en invitant ou en ajoutant un invité", () => {
    expect(familyActions(overview())).toEqual({ invite: null, addGuest: null });
    expect(familyCounts(null)).toEqual({ profiles: 1, guests: 0, members: 0, pending: 0 });
  });

  it("le propriétaire : complet à six profils, invitations en attente comprises ; trois invités au plus", () => {
    expect(familyActions(overview({ family: family("owner", { members: 3, guests: 1, pending: 1 }) }))).toEqual({
      invite: "family.full",
      addGuest: "family.full",
    });
    expect(familyActions(overview({ family: family("owner", { members: 0, guests: 3, pending: 0 }) }))).toEqual({
      invite: null,
      addGuest: "family.guests_full",
    });
  });

  it("un membre n'invite jamais ; il crée un invité seulement si le propriétaire le lui permet", () => {
    const counts = { members: 1, guests: 0, pending: 0 };
    expect(familyActions(overview({ family: family("member", counts) }, { canOwn: false, canJoin: false }))).toEqual({
      invite: "family.not_owner",
      addGuest: "family.guest_right_required",
    });
    expect(familyActions(overview({ family: family("member", counts, true) }, { canOwn: false, canJoin: false })).addGuest).toBeNull();
  });

  it("vaut aussi hors session personnelle (gestion des profils de la TV) ; démonstration et invité n'ajoutent rien", () => {
    expect(familyActions(overview({ family: family("owner", { members: 0, guests: 0, pending: 0 }) }, { personalSession: false }))).toEqual({
      invite: null,
      addGuest: null,
    });
    expect(familyActions(overview({}, { reviewAccount: true })).addGuest).toBe("family.review_account");
    expect(familyActions(overview({}, { canOwn: false })).invite).toBe("family.guest_account");
    expect(familyActions(overview({ switches: { families: true, guests: false } })).addGuest).toBe("family.guests_disabled");
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
