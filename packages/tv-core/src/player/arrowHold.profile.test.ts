import { describe, expect, it } from "vitest";
import { TVOS_BINDINGS } from "../remote/bindings/tvos";
import { scrubInputProfileOf } from "./arrowHold";

describe("scrubInputProfileOf — le profil des flèches lu dans les traits", () => {
  it("maintien annoncé : le profil de l'Apple TV, à l'identique", () => {
    expect(scrubInputProfileOf(TVOS_BINDINGS.traits)).toEqual({
      tapOnRelease: false, holdFromKeyDown: false, holdArmMs: 0, holdEndAnnounced: true,
    });
  });

  it("key-down et répétitions bruts : le profil d'avant d'Android TV", () => {
    expect(scrubInputProfileOf({ announcedHolds: false })).toEqual({
      tapOnRelease: true, holdFromKeyDown: true, holdArmMs: 250, holdEndAnnounced: false,
    });
  });
});
