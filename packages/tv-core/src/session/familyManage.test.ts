import { describe, expect, it } from "vitest";
import type { FamilyOverviewDto, FamilyProfileDto, FamilyRights } from "@tentacle-tv/shared";

import { manageActionRows, manageCapacity, manageRows } from "./familyManage";

const profile = (userId: string, kind: FamilyProfileDto["kind"]): FamilyProfileDto => ({
  userId, kind, name: userId, color: "teal", hasPin: false, imageTag: null, since: kind === "owner" ? null : "2026-10-04T20:00:00Z",
  createdBy: null, createdByName: null, rights: kind === "member" ? { createGuests: false } : null,
});

function overview(profiles: FamilyProfileDto[], patch: Partial<FamilyOverviewDto> = {}, pending = 0): FamilyOverviewDto {
  return {
    v: 1,
    switches: { families: true, guests: true },
    account: { canOwn: true, canJoin: true, reviewAccount: false, hasPin: false, personalSession: false },
    family: null,
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

describe("« Gérer les profils » dans la famille partagée (v2)", () => {
  const ANNE = profile("anne", "owner");
  const MARC = { ...profile("marc", "member"), rights: { createGuests: true } };
  const ZOE = { ...profile("zoe", "guest"), createdBy: "marc", createdByName: "Marc" };
  const LEA = { ...profile("lea", "guest"), createdBy: "anne", createdByName: "Anne" };

  function shared(role: "owner" | "member", rights: FamilyRights, pending = 0): FamilyOverviewDto {
    const base = overview([], { owned: null }, 0);
    return {
      ...base,
      v: 2,
      family: {
        id: "famille", role, owner: { userId: "anne", name: "Anne" }, profiles: [ANNE, MARC, ZOE, LEA],
        pendingInvitations: Array.from({ length: pending }, (_, i) => ({
          id: `inv-${i}`, inviteeUserId: `invite-${i}`, inviteeName: `Invité ${i}`, createdAt: "2026-10-04T20:00:00Z", expiresAt: "2026-10-11T20:00:00Z",
        })),
        rights, createdAt: "2026-10-04T20:00:00Z", since: role === "owner" ? null : "2026-10-04T20:00:00Z",
      },
    };
  }

  it("le propriétaire gère tout, et règle les droits de chaque membre", () => {
    const rows = manageRows(shared("owner", { manageMembers: true, createGuests: true, manageGuests: "all" }, 1), { userId: "anne", name: "Anne", color: "violet" });
    expect(rows.map((row) => [row.id, row.action])).toEqual([["anne", null], ["marc", "remove"], ["zoe", "delete"], ["lea", "delete"], ["inv-0", "cancel"]]);
    expect(rows[1].memberRights).toEqual({ createGuests: true });
    expect(rows[2].createdByName).toBe("Marc");
    // Un invité du propriétaire : rien à dire de son créateur.
    expect(rows[3].createdByName).toBeNull();
  });

  it("le propriétaire règle « Peut demander des films » d'un invité, si le serveur annonce le droit", () => {
    const owner: FamilyRights = { manageMembers: true, createGuests: true, manageGuests: "all" };
    const actor = { userId: "anne", name: "Anne", color: "violet" as const };
    const withRight = { ...shared("owner", owner) };
    withRight.family = { ...withRight.family!, profiles: [ANNE, MARC, { ...ZOE, guestRights: { requestTitles: true } }, LEA] };
    const rows = manageRows(withRight, actor, { guestRequests: true });
    expect(rows.map((row) => row.guestRights)).toEqual([null, null, { requestTitles: true }, { requestTitles: false }]);
    // Un serveur qui ne l'annonce pas : aucune case.
    expect(manageRows(withRight, actor).every((row) => row.guestRights === null)).toBe(true);
    // Un membre ne la règle jamais.
    const member: FamilyRights = { manageMembers: false, createGuests: true, manageGuests: "own" };
    expect(manageRows(shared("member", member), { userId: "marc", name: "Marc", color: "teal" }, { guestRequests: true }).every((row) => row.guestRights === null)).toBe(true);
  });

  it("un membre ne gère que SES invités : ni retrait, ni droits, ni invitations", () => {
    const rights: FamilyRights = { manageMembers: false, createGuests: true, manageGuests: "own" };
    const rows = manageRows(shared("member", rights), { userId: "marc", name: "Marc", color: "teal" });
    expect(rows.map((row) => [row.id, row.action])).toEqual([["anne", null], ["marc", null], ["zoe", "delete"], ["lea", null]]);
    // Zoé, sur la TV de Marc qui l'a créée : « ajouté par vous ».
    expect(rows[2]).toMatchObject({ createdByName: "Marc", createdByYou: true });
    expect(rows.every((row) => row.memberRights === null)).toBe(true);
    expect(manageCapacity(shared("member", rights))).toMatchObject({ canCreateGuest: true, canInvite: false, inviteBlock: null });
  });

  it("un membre sans le droit de créer des invités : la page dit pourquoi", () => {
    const rights: FamilyRights = { manageMembers: false, createGuests: false, manageGuests: "own" };
    expect(manageCapacity(shared("member", rights))).toMatchObject({ canCreateGuest: false, guestBlock: "noGuestRight", canInvite: false });
    // Il garde la main sur ceux qu'il a créés.
    expect(manageRows(shared("member", rights), { userId: "marc", name: "Marc", color: "teal" })[2].action).toBe("delete");
  });
});
