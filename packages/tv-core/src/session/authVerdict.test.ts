import { describe, expect, it } from "vitest";

import { authVerdictApplies } from "./authVerdict";

describe("le verdict du serveur sur un jeton", () => {
  it("vaut pour la session tant qu'elle porte encore ce jeton", () => {
    expect(authVerdictApplies("ancien", "ancien")).toBe(true);
  });

  it("ne vaut plus si l'échange ou un profil a remplacé le jeton pendant l'appel", () => {
    // L'échange a ôté l'ancien jeton (la TV n'a plus que son jeton de jumelage) : « révoqué » ne la déjumelle pas.
    expect(authVerdictApplies("ancien", null)).toBe(false);
    expect(authVerdictApplies("ancien", "session-de-profil")).toBe(false);
  });
});
