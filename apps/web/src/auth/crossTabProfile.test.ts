import { describe, expect, it } from "vitest";
import { profileChangedElsewhere } from "./crossTabProfile";

describe("un autre onglet change de profil", () => {
  it("entrer dans un profil, en sortir ou passer à un autre : recharger", () => {
    expect(profileChangedElsewhere({ key: "tentacle_profile_session", oldValue: null, newValue: "{\"id\":\"lea\"}" })).toBe(true);
    expect(profileChangedElsewhere({ key: "tentacle_profile_session", oldValue: "{\"id\":\"lea\"}", newValue: null })).toBe(true);
    expect(profileChangedElsewhere({ key: "tentacle_profile_session", oldValue: "{\"id\":\"lea\"}", newValue: "{\"id\":\"zoe\"}" })).toBe(true);
  });

  it("rien d'autre : ni le jeton (déconnexion), ni une autre clé, ni une écriture identique", () => {
    expect(profileChangedElsewhere({ key: "tentacle_token", oldValue: "a", newValue: null })).toBe(false);
    expect(profileChangedElsewhere({ key: null, oldValue: null, newValue: null })).toBe(false);
    expect(profileChangedElsewhere({ key: "tentacle_profile_session", oldValue: "x", newValue: "x" })).toBe(false);
    // La photo du profil, réécrite dans sa marque : même profil.
    expect(profileChangedElsewhere({
      key: "tentacle_profile_session",
      oldValue: "{\"id\":\"lea\",\"imageTag\":null}",
      newValue: "{\"id\":\"lea\",\"imageTag\":\"t1\"}",
    })).toBe(false);
  });
});
