import { describe, expect, it } from "vitest";
import { canResetPrompts, familyRightsOf, type PromptsResetTarget } from "./familyRights";

const ON = { families: true, guests: true };
const owner = familyRightsOf("owner", null, ON);
const parent = familyRightsOf("member", { createGuests: false }, ON, { parent: true });
const member = familyRightsOf("member", { createGuests: true }, ON);

const OWNER: PromptsResetTarget = { userId: "own-er", kind: "owner", createdBy: null };
const MINOR: PromptsResetTarget = { userId: "minor", kind: "member", createdBy: null };
const PARENT: PromptsResetTarget = { userId: "parent", kind: "member", parent: true, createdBy: null };
const GUEST_OF_MEMBER: PromptsResetTarget = { userId: "guest-1", kind: "guest", createdBy: "member" };
const GUEST_OF_OWNER: PromptsResetTarget = { userId: "guest-2", kind: "guest", createdBy: "ownEr" };

describe("canResetPrompts — mêmes droits que le code ou la photo du profil", () => {
  it("chacun pour lui-même (identifiant comparé sans tirets ni casse)", () => {
    expect(canResetPrompts(owner, OWNER, "OWNER")).toBe(true);
    expect(canResetPrompts(member, MINOR, "minor")).toBe(true);
    expect(canResetPrompts(parent, PARENT, "parent")).toBe(true);
  });

  it("jamais un invité pour lui-même : il n'a pas de session personnelle", () => {
    expect(canResetPrompts(familyRightsOf(null, null, ON), GUEST_OF_OWNER, "guest-2")).toBe(false);
  });

  it("le propriétaire, pour tout profil de sa famille", () => {
    for (const target of [MINOR, PARENT, GUEST_OF_MEMBER, GUEST_OF_OWNER]) expect(canResetPrompts(owner, target, "owner")).toBe(true);
  });

  it("un parent, pour les invités et les membres mineurs — jamais un autre parent ni le propriétaire", () => {
    expect(canResetPrompts(parent, GUEST_OF_MEMBER, "parent")).toBe(true);
    expect(canResetPrompts(parent, MINOR, "parent")).toBe(true);
    expect(canResetPrompts(parent, { ...PARENT, userId: "other-parent" }, "parent")).toBe(false);
    expect(canResetPrompts(parent, OWNER, "parent")).toBe(false);
  });

  it("un membre, pour les invités qu'il a créés seulement", () => {
    expect(canResetPrompts(member, GUEST_OF_MEMBER, "member")).toBe(true);
    expect(canResetPrompts(member, GUEST_OF_OWNER, "member")).toBe(false);
    expect(canResetPrompts(member, MINOR, "member")).toBe(false);
    expect(canResetPrompts(member, OWNER, "member")).toBe(false);
  });
});
