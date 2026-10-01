import { describe, expect, it } from "vitest";
import { readTitlesMeta } from "./pluginTitlesMeta";

describe("readTitlesMeta — le champ titles d'un manifeste de plugin", () => {
  it("relaie l'état et la demande d'un champ bien formé", () => {
    expect(readTitlesMeta({ titles: { state: "/titles/state", request: "/titles/request" } }))
      .toEqual({ state: "/titles/state", request: "/titles/request" });
  });

  it("ignore un champ absent, nul, scalaire ou tableau", () => {
    expect(readTitlesMeta({})).toBeUndefined();
    expect(readTitlesMeta({ titles: null })).toBeUndefined();
    expect(readTitlesMeta({ titles: "/titles/state" })).toBeUndefined();
    expect(readTitlesMeta({ titles: ["/titles/state"] })).toBeUndefined();
    expect(readTitlesMeta(null)).toBeUndefined();
  });

  it("refuse tout chemin d'état qui sortirait de la racine du plugin", () => {
    for (const state of ["titles", "//evil.example/x", "/../admin", "/a?b=1", "https://x.y/z", "/a//b", "", "/"]) {
      expect(readTitlesMeta({ titles: { state } }), state).toBeUndefined();
    }
  });

  it("ignore seule une route de demande mal formée", () => {
    for (const request of ["//evil.example/x", "/../admin", "https://x.y/z", 3, ""]) {
      expect(readTitlesMeta({ titles: { state: "/s", request } }), String(request)).toEqual({ state: "/s" });
    }
  });

  it("relaie le droit du compte et les titres attendus quand le plugin les déclare", () => {
    expect(readTitlesMeta({
      titles: { state: "/titles/state", request: "/titles/request", access: "/titles/access", mine: "/titles/mine" },
    })).toEqual({ state: "/titles/state", request: "/titles/request", access: "/titles/access", mine: "/titles/mine" });
  });

  it("garde le contrat d'avant pour un plugin qui ne déclare ni access ni mine", () => {
    expect(Object.keys(readTitlesMeta({ titles: { state: "/s", request: "/r" } }) ?? {})).toEqual(["state", "request"]);
  });

  it("relaie les saisons quand le plugin les déclare, ignore seule une route mal formée", () => {
    expect(readTitlesMeta({ titles: { state: "/s", seasons: "/titles/seasons" } })).toEqual({ state: "/s", seasons: "/titles/seasons" });
    for (const bad of ["//evil.example/x", "/../admin", "https://x.y/z", 3, "", null]) {
      expect(readTitlesMeta({ titles: { state: "/s", seasons: bad } }), String(bad)).toEqual({ state: "/s" });
    }
  });

  it("ignore seuls un droit ou une liste mal formés, et jamais sans état", () => {
    for (const bad of ["//evil.example/x", "/../admin", "https://x.y/z", 3, "", null]) {
      expect(readTitlesMeta({ titles: { state: "/s", access: bad, mine: bad } }), String(bad)).toEqual({ state: "/s" });
    }
    expect(readTitlesMeta({ titles: { access: "/titles/access", mine: "/titles/mine" } })).toBeUndefined();
  });
});
