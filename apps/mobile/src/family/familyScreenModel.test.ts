import { describe, expect, it } from "vitest";
import { familyRightsOf, type FamilyDto, type FamilyOverviewDto, type FamilyProfileDto, type FamilyRole } from "@tentacle-tv/shared";
import { familyScreenModel } from "./familyScreenModel";

const NOW = "2026-10-04T12:00:00.000Z";
const SWITCHES = { families: true, guests: true };

function profile(kind: FamilyProfileDto["kind"], userId: string, extra: Partial<FamilyProfileDto> = {}): FamilyProfileDto {
  return {
    userId, kind, name: userId, color: "violet", hasPin: false, imageTag: null, since: kind === "owner" ? null : NOW,
    createdBy: kind === "guest" ? "o" : null, createdByName: kind === "guest" ? "o" : null,
    rights: kind === "member" ? { createGuests: false } : null, ...extra,
  };
}

function family(role: FamilyRole, opts: { members?: number; guests?: number; pending?: number; createGuests?: boolean } = {}): FamilyDto {
  return {
    id: "f",
    role,
    owner: { userId: "o", name: "Damien" },
    profiles: [
      profile("owner", "o"),
      ...Array.from({ length: opts.members ?? 0 }, (_, i) => profile("member", `m${i}`)),
      ...Array.from({ length: opts.guests ?? 0 }, (_, i) => profile("guest", `g${i}`)),
    ],
    pendingInvitations: Array.from({ length: opts.pending ?? 0 }, (_, i) => ({
      id: `i${i}`, inviteeUserId: `u${i}`, inviteeName: `U${i}`, createdAt: NOW, expiresAt: NOW,
    })),
    rights: familyRightsOf(role, role === "member" ? { createGuests: opts.createGuests === true } : null, SWITCHES),
    createdAt: NOW,
    since: role === "owner" ? null : NOW,
  };
}

function overview(patch: Partial<FamilyOverviewDto> = {}, account: Partial<FamilyOverviewDto["account"]> = {}): FamilyOverviewDto {
  return {
    v: 2,
    switches: SWITCHES,
    account: { canOwn: true, canJoin: true, reviewAccount: false, hasPin: false, personalSession: true, ...account },
    family: null,
    owned: null,
    memberships: [],
    incoming: [],
    limits: { maxProfiles: 6, maxGuests: 3 },
    ...patch,
  };
}

const INVITATION = { id: "i", familyId: "f2", ownerUserId: "x", ownerName: "X", createdAt: NOW, expiresAt: NOW, snoozedUntil: null };

describe("familyScreenModel — sans famille", () => {
  it("répond aux invitations reçues, ou crée sa famille (inviter, ajouter un invité)", () => {
    const model = familyScreenModel(overview({ incoming: [INVITATION] }));
    expect(model).toMatchObject({
      role: null, showIncoming: true, showInvite: true, showAddGuest: true, invite: null, addGuest: null,
      showLeave: false, showDissolve: false, showPending: false, showMyPin: true, blocked: null,
    });
  });
});

describe("familyScreenModel — propriétaire", () => {
  it("invite, ajoute, voit ses invitations en attente, dissout ; ne quitte pas", () => {
    const model = familyScreenModel(overview({ family: family("owner", { pending: 1 }), incoming: [INVITATION] }));
    expect(model).toMatchObject({
      role: "owner", showIncoming: false, showInvite: true, showAddGuest: true, showPending: true,
      showDissolve: true, showLeave: false,
    });
  });

  it("dit la famille complète, puis les trois invités", () => {
    expect(familyScreenModel(overview({ family: family("owner", { members: 4, guests: 1 }) })).blocked).toBe("family.full");
    expect(familyScreenModel(overview({ family: family("owner", { guests: 3 }) }))).toMatchObject({ invite: null, blocked: "family.guests_full" });
  });
});

describe("familyScreenModel — membre", () => {
  it("voit la famille, quitte, n'invite jamais, ne dissout pas", () => {
    const model = familyScreenModel(overview({ family: family("member", { members: 1 }) }, { canOwn: false, canJoin: false }));
    expect(model).toMatchObject({
      role: "member", showInvite: false, showAddGuest: false, showLeave: true, showDissolve: false,
      showPending: false, showMyPin: true, invite: "family.not_owner",
    });
  });

  it("sans le droit : pas de bouton, la page dit pourquoi ; avec : il ajoute un invité", () => {
    const without = familyScreenModel(overview({ family: family("member", { members: 1 }) }, { canOwn: false, canJoin: false }));
    expect(without).toMatchObject({ showAddGuest: false, blocked: "family.guest_right_required" });
    const granted = familyScreenModel(overview({ family: family("member", { members: 1, createGuests: true }) }, { canOwn: false, canJoin: false }));
    expect(granted).toMatchObject({ showAddGuest: true, addGuest: null, blocked: null });
  });
});

describe("familyScreenModel — encarts", () => {
  it("dit les interrupteurs dans un encart, pas sous la famille", () => {
    expect(familyScreenModel(overview({ switches: { families: false, guests: true } }))).toMatchObject({ notices: ["notice.disabled"], blocked: null });
    expect(familyScreenModel(overview({ switches: { families: true, guests: false } }))).toMatchObject({ notices: ["notice.guestsDisabled"], blocked: null });
  });

  it("le compte de démonstration n'ajoute rien ; hors session personnelle, rien ne se gère", () => {
    expect(familyScreenModel(overview({}, { reviewAccount: true })).blocked).toBe("family.review_account");
    expect(familyScreenModel(overview({}, { personalSession: false }))).toMatchObject({
      notices: ["notice.personalOnly"], showInvite: false, showAddGuest: false, showMyPin: false, blocked: null,
    });
  });
});
