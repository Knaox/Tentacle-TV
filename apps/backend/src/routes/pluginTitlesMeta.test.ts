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
});
