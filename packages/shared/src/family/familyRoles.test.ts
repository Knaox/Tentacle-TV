import { describe, expect, it } from "vitest";
import { GUEST_PARENTAL_NONE } from "./familyParental";
import {
  FAMILY_CREATION_DEFAULTS,
  FAMILY_DEFAULT_CREATION_RIGHTS,
  creationRightValue,
  isParentalNone,
  isRestrictableMember,
  resolveFamilyCreation,
} from "./familyRoles";

const ON = { families: true, guests: true };

describe("resolveFamilyCreation", () => {
  const base = { rights: FAMILY_DEFAULT_CREATION_RIGHTS, defaults: FAMILY_CREATION_DEFAULTS, switches: ON, isAdministrator: false };

  it("par défaut, un compte ne crée rien : le défaut de l'administration est NON pour les deux", () => {
    expect(resolveFamilyCreation(base)).toEqual({ createFamily: false, createGuests: false });
  });

  it("`inherit` suit le défaut ; `allow` et `deny` l'emportent sur lui", () => {
    const defaults = { createFamily: true, createGuests: false };
    expect(resolveFamilyCreation({ ...base, defaults })).toEqual({ createFamily: true, createGuests: false });
    expect(resolveFamilyCreation({ ...base, defaults, rights: { createFamily: "deny", createGuests: "allow" } })).toEqual({
      createFamily: false,
      createGuests: true,
    });
  });

  it("un administrateur Jellyfin peut toujours, même refusé", () => {
    expect(resolveFamilyCreation({ ...base, isAdministrator: true, rights: { createFamily: "deny", createGuests: "deny" } })).toEqual({
      createFamily: true,
      createGuests: true,
    });
  });

  it("les interrupteurs restent maîtres : coupés, personne — administrateur compris", () => {
    const allow = { createFamily: "allow", createGuests: "allow" } as const;
    expect(resolveFamilyCreation({ ...base, rights: allow, switches: { families: false, guests: true } })).toEqual({
      createFamily: false,
      createGuests: false,
    });
    expect(resolveFamilyCreation({ ...base, isAdministrator: true, switches: { families: true, guests: false } })).toEqual({
      createFamily: true,
      createGuests: false,
    });
  });

  it("un réglage illisible vaut `inherit`", () => {
    expect(creationRightValue("allow")).toBe("allow");
    expect(creationRightValue("ALLOW")).toBe("inherit");
    expect(creationRightValue(null)).toBe("inherit");
  });
});

describe("membre mineur", () => {
  it("aucun réglage vaut un retrait ; un seul réglage, non", () => {
    expect(isParentalNone(GUEST_PARENTAL_NONE)).toBe(true);
    expect(isParentalNone({ ...GUEST_PARENTAL_NONE, maxParentalRating: 6 })).toBe(false);
    expect(isParentalNone({ ...GUEST_PARENTAL_NONE, blockedTags: ["horreur"] })).toBe(false);
    expect(isParentalNone({ ...GUEST_PARENTAL_NONE, accessSchedules: [{ dayOfWeek: "Everyday", startHour: 8, endHour: 20 }] })).toBe(false);
  });

  it("ni le propriétaire, ni un parent, ni un administrateur — ni un compte dont on ne sait rien", () => {
    expect(isRestrictableMember({ kind: "member" }, false)).toBe(true);
    expect(isRestrictableMember({ kind: "member", parent: false }, false)).toBe(true);
    expect(isRestrictableMember({ kind: "member", parent: true }, false)).toBe(false);
    expect(isRestrictableMember({ kind: "owner" }, false)).toBe(false);
    expect(isRestrictableMember({ kind: "guest" }, false)).toBe(false);
    expect(isRestrictableMember({ kind: "member" }, true)).toBe(false);
    expect(isRestrictableMember({ kind: "member" }, null)).toBe(false);
  });
});
