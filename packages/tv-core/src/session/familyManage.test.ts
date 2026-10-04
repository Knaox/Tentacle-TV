import { describe, expect, it } from "vitest";
import type { FamilyOverviewDto, FamilyProfileDto } from "@tentacle-tv/shared";

import { manageActionRows, manageCapacity, manageRows } from "./familyManage";

const profile = (userId: string, kind: FamilyProfileDto["kind"]): FamilyProfileDto => ({
  userId, kind, name: userId, color: "teal", hasPin: false, imageTag: null, since: kind === "owner" ? null : "2026-10-04T20:00:00Z",
});

function overview(profiles: FamilyProfileDto[], patch: Partial<FamilyOverviewDto> = {}, pending = 0): FamilyOverviewDto {
  return {
    v: 1,
    switches: { families: true, guests: true },
    account: { canOwn: true, canJoin: true, reviewAccount: false, hasPin: false, personalSession: false },
    owned: {
      id: "famille",
      profiles,
      pendingInvitations: Array.from({ length: pending }, (_, i) => ({
        id: `inv-${i}`, inviteeUserId: `invite-${i}`, inviteeName: `Invité ${i}`, createdAt: "2026-10-04T20:00:00Z", expiresAt: "2026-10-11T20:00:00Z",
      })),
      createdAt: "2026-10-04T20:00:00Z",
    },
    memberships: [],
    incoming: [],
    limits: { maxProfiles: 6, maxGuests: 3 },
    ...patch,
  };
}

const OWNER = profile("damien", "owner");

describe("« Gérer les profils »", () => {
  it("liste le propriétaire, ses membres, ses invités puis les invitations, avec leur geste", () => {
    const rows = manageRows(overview([OWNER, profile("nina", "member"), profile("lea", "guest")], {}, 1), { userId: "damien", name: "Damien", color: "violet" });
    expect(rows.map((row) => [row.kind, row.action])).toEqual([
      ["owner", null], ["member", "remove"], ["guest", "delete"], ["invitation", "cancel"],
    ]);
    expect(rows[3]).toMatchObject({ id: "inv-0", userId: "invite-0", name: "Invité 0", expiresAt: "2026-10-11T20:00:00Z" });
    expect(manageActionRows(rows)).toEqual([1, 2, 3]);
  });

  it("sans famille encore, montre le propriétaire seul", () => {
    const rows = manageRows(overview([], { owned: null }), { userId: "damien", name: "Damien", color: "violet" });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "owner", name: "Damien", action: null });
  });

  it("ne propose pas un geste voué au refus", () => {
    const three = [OWNER, profile("a", "guest"), profile("b", "guest"), profile("c", "guest")];
    expect(manageCapacity(overview(three))).toMatchObject({ canCreateGuest: false, guestBlock: "guestsFull", canInvite: true, profiles: 4 });
    // Une invitation en attente réserve sa place.
    const full = overview([OWNER, profile("a", "member"), profile("b", "member"), profile("c", "guest")], {}, 2);
    expect(manageCapacity(full)).toMatchObject({ profiles: 6, canCreateGuest: false, canInvite: false, guestBlock: "full", inviteBlock: "full" });
  });

  it("suit les interrupteurs de l'administration et le compte de démonstration", () => {
    const base = [OWNER];
    expect(manageCapacity(overview(base, { switches: { families: true, guests: false } }))).toMatchObject({ canCreateGuest: false, guestBlock: "guestsOff", canInvite: true });
    expect(manageCapacity(overview(base, { switches: { families: false, guests: true } }))).toMatchObject({ guestBlock: "familiesOff", inviteBlock: "familiesOff" });
    const review = overview(base, { account: { canOwn: true, canJoin: false, reviewAccount: true, hasPin: false, personalSession: false } });
    expect(manageCapacity(review)).toMatchObject({ canCreateGuest: false, canInvite: false });
  });
});
