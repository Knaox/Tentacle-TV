import { describe, expect, it } from "vitest";
import { readTabMeta } from "./pluginTabMeta";

describe("readTabMeta — le champ tab d'un manifeste de plugin", () => {
  it("relaie icône et libellés d'un champ bien formé", () => {
    expect(readTabMeta({ tab: { icon: "send", labels: { fr: "Demandes", en: "Requests" } } })).toEqual({
      icon: "send",
      labels: { fr: "Demandes", en: "Requests" },
    });
  });

  it("ignore un champ absent, nul, scalaire ou tableau", () => {
    expect(readTabMeta({})).toBeUndefined();
    expect(readTabMeta({ tab: null })).toBeUndefined();
    expect(readTabMeta({ tab: "send" })).toBeUndefined();
    expect(readTabMeta({ tab: ["send"] })).toBeUndefined();
    expect(readTabMeta(null)).toBeUndefined();
  });

  it("ne garde que les libellés qui sont des chaînes non vides", () => {
    expect(readTabMeta({ tab: { labels: { fr: "Demandes", en: 3, de: "" } } })).toEqual({
      labels: { fr: "Demandes" },
    });
  });

  it("retombe sur rien quand ni icône ni libellé n'est exploitable", () => {
    expect(readTabMeta({ tab: { icon: 12, labels: { fr: 1 } } })).toBeUndefined();
    expect(readTabMeta({ tab: { icon: "  " } })).toBeUndefined();
  });

  it("garde l'icône seule", () => {
    expect(readTabMeta({ tab: { icon: "grid" } })).toEqual({ icon: "grid" });
  });
});
