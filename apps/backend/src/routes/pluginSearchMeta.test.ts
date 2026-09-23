import { describe, expect, it } from "vitest";
import { readSearchMeta } from "./pluginSearchMeta";

describe("readSearchMeta — le champ search d'un manifeste de plugin", () => {
  it("relaie chemin, types et libellés d'un champ bien formé", () => {
    expect(readSearchMeta({
      search: { path: "/search/provider", types: ["movie", "series"], labels: { fr: "Ailleurs", en: "Elsewhere" } },
    })).toEqual({ path: "/search/provider", types: ["movie", "series"], labels: { fr: "Ailleurs", en: "Elsewhere" } });
  });

  it("ignore un champ absent, nul, scalaire ou tableau", () => {
    expect(readSearchMeta({})).toBeUndefined();
    expect(readSearchMeta({ search: null })).toBeUndefined();
    expect(readSearchMeta({ search: "/search" })).toBeUndefined();
    expect(readSearchMeta({ search: ["/search"] })).toBeUndefined();
    expect(readSearchMeta(null)).toBeUndefined();
  });

  it("refuse tout chemin qui sortirait de la racine du plugin", () => {
    for (const path of ["search", "//evil.example/x", "/../admin", "/a?b=1", "https://x.y/z", "/a//b", "", "/"]) {
      expect(readSearchMeta({ search: { path } }), path).toBeUndefined();
    }
  });

  it("ne garde que les types connus", () => {
    expect(readSearchMeta({ search: { path: "/s", types: ["movie", "music", 3] } })).toEqual({ path: "/s", types: ["movie"] });
    expect(readSearchMeta({ search: { path: "/s", types: ["music"] } })).toEqual({ path: "/s" });
  });

  it("ne garde que les libellés qui sont des chaînes non vides", () => {
    expect(readSearchMeta({ search: { path: "/s", labels: { fr: " Ailleurs ", en: 3, de: "" } } })).toEqual({
      path: "/s",
      labels: { fr: "Ailleurs" },
    });
  });
});
