import { describe, expect, it } from "vitest";
import { homeAfterProfileSwitch, manageProfilesPath } from "./profileSwitchPaths";

describe("changer de profil garde le mode en cours", () => {
  it("dans Octave : l'accueil d'Octave, et « Gérer les profils » dans Octave", () => {
    expect(homeAfterProfileSwitch(true)).toBe("/octave");
    expect(manageProfilesPath(true)).toBe("/octave/profiles");
  });

  it("dans Tentacle : comme avant", () => {
    expect(homeAfterProfileSwitch(false)).toBe("/(tabs)");
    expect(manageProfilesPath(false)).toBe("/family");
  });
});
