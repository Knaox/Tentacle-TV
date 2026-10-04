import { describe, expect, it } from "vitest";
import { familyRightsOf, type FamilyDto, type FamilyProfileDto, type FamilyRole } from "@tentacle-tv/shared";
import { hasPanel, profilePanelRights } from "./profilePanelRights";

const SWITCHES = { families: true, guests: true };

function profile(kind: FamilyProfileDto["kind"], userId: string, createdBy: string | null = null): FamilyProfileDto {
  return {
    userId, kind, name: userId, color: "violet", hasPin: false, imageTag: null, since: null,
    createdBy, createdByName: createdBy, rights: kind === "member" ? { createGuests: true } : null,
  };
}

function family(role: FamilyRole): FamilyDto {
  return {
    id: "f", role, owner: { userId: "o", name: "o" }, profiles: [], pendingInvitations: [],
    rights: familyRightsOf(role, role === "member" ? { createGuests: true } : null, SWITCHES), createdAt: "", since: null,
  };
}

describe("profilePanelRights", () => {
  it("le propriétaire règle les droits d'un membre et le retire ; il gère tout invité", () => {
    expect(profilePanelRights(family("owner"), profile("member", "m"), "o")).toEqual({ pin: false, remove: true, memberRights: true });
    expect(profilePanelRights(family("owner"), profile("guest", "g", "m"), "o")).toEqual({ pin: true, remove: true, memberRights: false });
  });

  it("un membre ne gère que SES invités — ni un autre membre, ni l'invité d'un autre", () => {
    expect(profilePanelRights(family("member"), profile("guest", "g1", "m-1"), "M1")).toEqual({ pin: true, remove: true, memberRights: false });
    expect(hasPanel(profilePanelRights(family("member"), profile("guest", "g2", "o"), "m1"))).toBe(false);
    expect(hasPanel(profilePanelRights(family("member"), profile("member", "m2"), "m1"))).toBe(false);
  });

  it("personne ne gère le propriétaire, ni sans identité connue", () => {
    expect(hasPanel(profilePanelRights(family("owner"), profile("owner", "o"), "o"))).toBe(false);
    expect(hasPanel(profilePanelRights(family("owner"), profile("guest", "g", "o"), null))).toBe(false);
  });
});
