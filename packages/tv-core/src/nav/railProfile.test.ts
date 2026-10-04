import { describe, expect, it } from "vitest";

import { RAIL_PROFILE_KEY } from "./railKeys";
import { railHold } from "./railProfile";

describe("l'appui maintenu sur le rail", () => {
  it("ouvre le menu d'une entrée organisable, comme avant", () => {
    expect(railHold("Library_films", { moving: false, profiles: true })).toBe("menu");
    expect(railHold("Watchlist", { moving: false, profiles: false })).toBe("menu");
    expect(railHold("Home", { moving: false, profiles: true })).toBeNull();
  });

  it("sur le profil d'une TV passée aux profils, change de profil", () => {
    expect(railHold(RAIL_PROFILE_KEY, { moving: false, profiles: true })).toBe("switchProfile");
    // Une TV d'avant les profils : rien, comme avant.
    expect(railHold(RAIL_PROFILE_KEY, { moving: false, profiles: false })).toBeNull();
  });

  it("ne fait rien pendant un déplacement", () => {
    expect(railHold(RAIL_PROFILE_KEY, { moving: true, profiles: true })).toBeNull();
    expect(railHold("Library_films", { moving: true, profiles: true })).toBeNull();
  });
});
