import { describe, expect, it } from "vitest";
import type { TitleProvider } from "@tentacle-tv/shared";
import { MY_TITLES_KEY, myTitlesKeyOrigin, myTitlesQueryKey } from "./useMyTitles";

const provider: TitleProvider = {
  pluginId: "seer", statePath: "/titles/state", requestPath: "/titles/request", accessPath: "/titles/access",
  minePath: "/titles/mine", seasonsPath: null, gapsPath: null,
};

describe("les clés des titres attendus", () => {
  it("gardent la clé d'avant pour la liste entière", () => {
    expect(myTitlesQueryKey(provider, "fr")).toEqual([MY_TITLES_KEY, "seer", "fr"]);
    expect(myTitlesQueryKey(provider, "fr", null)).toEqual([MY_TITLES_KEY, "seer", "fr"]);
    expect(myTitlesKeyOrigin(myTitlesQueryKey(provider, "fr"))).toBeNull();
  });

  it("donnent sa propre clé à une origine, dans la même famille", () => {
    const key = myTitlesQueryKey(provider, "fr", "tv");
    expect(key).toEqual([MY_TITLES_KEY, "seer", "fr", "tv"]);
    // `[MY_TITLES_KEY]` et la clé d'avant, en préfixe, invalident les deux listes ensemble.
    expect(key.slice(0, 3)).toEqual(myTitlesQueryKey(provider, "fr"));
    expect(myTitlesKeyOrigin(key)).toBe("tv");
  });

  it("ne lisent une origine que sur une clé de la famille", () => {
    expect(myTitlesKeyOrigin(["title-state", "seer", "fr", "tv"])).toBeNull();
    expect(myTitlesKeyOrigin([MY_TITLES_KEY, "seer", "fr", "web"])).toBeNull();
  });
});
