import { describe, expect, it } from "vitest";
import { accessChangesFor, accessLevelOf, type FamilyAccessState } from "./familyAccessModel";

function state(families: boolean, guests: boolean, createFamily: boolean, createGuests: boolean): FamilyAccessState {
  return { switches: { families, guests }, defaults: { createFamily, createGuests } };
}

describe("accessLevelOf", () => {
  it("interrupteur coupé : « Coupées », quel que soit le défaut", () => {
    expect(accessLevelOf("families", state(false, true, true, true))).toBe("off");
    expect(accessLevelOf("guests", state(true, false, true, true))).toBe("off");
  });

  it("allumé : le défaut choisit entre comptes permis et tous les comptes", () => {
    expect(accessLevelOf("families", state(true, true, false, true))).toBe("allowed");
    expect(accessLevelOf("families", state(true, true, true, false))).toBe("everyone");
    expect(accessLevelOf("guests", state(true, true, true, false))).toBe("allowed");
    expect(accessLevelOf("guests", state(true, true, false, true))).toBe("everyone");
  });

  it("chaque fonction lit SON interrupteur et SON défaut", () => {
    expect(accessLevelOf("guests", state(false, true, false, true))).toBe("everyone");
  });
});

describe("accessChangesFor", () => {
  it("couper ne touche que l'interrupteur", () => {
    expect(accessChangesFor("families", state(true, true, true, true), "off")).toEqual({ switches: { families: false } });
  });

  it("rallumer pose le défaut ET l'interrupteur", () => {
    expect(accessChangesFor("families", state(false, true, false, false), "everyone")).toEqual({
      defaults: { createFamily: true },
      switches: { families: true },
    });
    expect(accessChangesFor("guests", state(true, false, true, true), "allowed")).toEqual({
      defaults: { createGuests: false },
      switches: { guests: true },
    });
  });

  it("entre deux positions allumées : le défaut seul", () => {
    expect(accessChangesFor("guests", state(true, true, false, false), "everyone")).toEqual({ defaults: { createGuests: true } });
  });

  it("la position en place : rien à écrire", () => {
    expect(accessChangesFor("families", state(true, true, false, false), "allowed")).toEqual({});
    expect(accessChangesFor("guests", state(true, false, false, true), "off")).toEqual({});
  });
});
