import { describe, expect, it } from "vitest";
import type { FamilyOverviewDto, OwnedFamilyDto } from "@tentacle-tv/shared";
import { familyScreenModel } from "./familyScreenModel";

const NOW = "2026-10-04T12:00:00.000Z";

function owned(guests = 0, members = 0): OwnedFamilyDto {
  return {
    id: "f",
    createdAt: NOW,
    pendingInvitations: [],
    profiles: [
      { userId: "o", kind: "owner", name: "Damien", color: "violet", hasPin: false, imageTag: null, since: null },
      ...Array.from({ length: members }, (_, i) => ({ userId: `m${i}`, kind: "member" as const, name: `M${i}`, color: "blue" as const, hasPin: false, imageTag: null, since: NOW })),
      ...Array.from({ length: guests }, (_, i) => ({ userId: `g${i}`, kind: "guest" as const, name: `G${i}`, color: "teal" as const, hasPin: false, imageTag: null, since: NOW })),
    ],
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

describe("familyScreenModel", () => {
  it("un compte sans famille : rien qu'à créer, son code PIN, pas de dissolution", () => {
    const model = familyScreenModel(overview());
    expect(model).toMatchObject({ notices: [], showIncoming: false, showMemberships: false, showMyPin: true, showDissolve: false, invite: null, addGuest: null, blocked: null });
  });

  it("un propriétaire : la dissolution et son code PIN", () => {
    expect(familyScreenModel(overview({ owned: owned() }))).toMatchObject({ showMyPin: true, showDissolve: true });
  });

  it("les invitations reçues ne se montrent qu'en session personnelle", () => {
    const incoming = [{ id: "i", familyId: "f", ownerUserId: "o", ownerName: "D", createdAt: NOW, expiresAt: NOW, snoozedUntil: null }];
    expect(familyScreenModel(overview({ incoming })).showIncoming).toBe(true);
    const tv = familyScreenModel(overview({ incoming }, { personalSession: false }));
    expect(tv).toMatchObject({ showIncoming: false, showMyPin: false, notices: ["notice.personalOnly"], blocked: null });
  });

  it("dit les interrupteurs dans un encart, pas sous la famille", () => {
    expect(familyScreenModel(overview({ switches: { families: false, guests: true } }))).toMatchObject({ notices: ["notice.disabled"], blocked: null });
    expect(familyScreenModel(overview({ switches: { families: true, guests: false } }))).toMatchObject({ notices: ["notice.guestsDisabled"], addGuest: "family.guests_disabled", blocked: null });
  });

  it("dit l'obstacle sous la famille : complète, trois invités, compte de démonstration", () => {
    expect(familyScreenModel(overview({ owned: owned(1, 4) })).blocked).toBe("family.full");
    expect(familyScreenModel(overview({ owned: owned(3) }))).toMatchObject({ invite: null, blocked: "family.guests_full" });
    expect(familyScreenModel(overview({}, { reviewAccount: true })).blocked).toBe("family.review_account");
  });

  it("un compte invité ne pose ni code PIN ni famille à lui", () => {
    const guest = familyScreenModel(overview({}, { canOwn: false, canJoin: false }));
    expect(guest).toMatchObject({ showMyPin: false, blocked: "family.guest_account" });
  });
});
