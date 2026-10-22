import { describe, expect, it } from "vitest";
import { MAX_REGIONS } from "./protocol";
import { parseBatch, parseSampleRects } from "./validate";

const good = { id: "barre", x: 24, y: 700, width: 600, height: 56, radius: 28, level: "regular", tint: null, interactive: false, z: 1 };

describe("parseBatch", () => {
  it("laisse passer un lot propre, champs facultatifs compris", () => {
    const parsed = parseBatch({
      enabled: true,
      upserts: [good, { ...good, id: "pastille", level: "tinted", tint: "#7C3AED66", group: "lecteur", spacing: 12, transition: 220 }],
      removes: ["ancienne"],
    });
    expect(parsed?.rejected).toBe(0);
    expect(parsed?.batch.enabled).toBe(true);
    expect(parsed?.batch.upserts).toHaveLength(2);
    expect(parsed?.batch.upserts[1]).toMatchObject({ group: "lecteur", spacing: 12, transition: 220, tint: "#7C3AED66" });
    expect(parsed?.batch.removes).toEqual(["ancienne"]);
  });

  it("écarte une région folle sans perdre les RETRAITS du même lot", () => {
    const parsed = parseBatch({
      upserts: [{ ...good, width: Number.NaN }, { ...good, id: "b", x: Infinity }, { ...good, id: "c" }],
      removes: ["panneau-ferme", 7, ""],
    });
    expect(parsed?.batch.upserts.map((r) => r.id)).toEqual(["c"]);
    expect(parsed?.batch.removes).toEqual(["panneau-ferme"]);
    expect(parsed?.rejected).toBe(4);
  });

  it("refuse ce que AppKit ne saurait pas poser", () => {
    const bad = [
      { ...good, level: "_variant" },
      { ...good, tint: "rgba(0,0,0,.5)" },
      { ...good, tint: "#FFF" },
      { ...good, width: -1 },
      { ...good, x: 1e9 },
      { ...good, id: "x".repeat(65) },
      { ...good, transition: 5000 },
      { ...good, interactive: "oui" },
    ];
    const parsed = parseBatch({ upserts: bad, removes: [] });
    expect(parsed?.batch.upserts).toEqual([]);
    expect(parsed?.rejected).toBe(bad.length);
  });

  it("ne laisse passer aucun champ inconnu jusqu'à AppKit", () => {
    const parsed = parseBatch({ upserts: [{ ...good, selector: "set_variant:" }], removes: [] });
    expect(parsed?.batch.upserts[0]).not.toHaveProperty("selector");
  });

  it("un lot de forme fausse est rejeté en bloc", () => {
    expect(parseBatch(null)).toBeNull();
    expect(parseBatch({ upserts: "a" })).toBeNull();
    expect(parseBatch({ upserts: [], removes: [], enabled: "oui" })).toBeNull();
    expect(parseBatch({ upserts: new Array(MAX_REGIONS * 4 + 1).fill(good), removes: [] })).toBeNull();
  });
});

describe("parseSampleRects", () => {
  it("garde des rectangles propres, refuse une forme fausse ou démesurée", () => {
    expect(parseSampleRects([{ x: 0, y: 0, width: 120, height: 40 }])).toEqual([{ x: 0, y: 0, width: 120, height: 40 }]);
    expect(parseSampleRects([{ x: 0, y: 0, width: -1, height: 40 }])).toBeNull();
    expect(parseSampleRects([{ x: Number.NaN, y: 0, width: 1, height: 1 }])).toBeNull();
    expect(parseSampleRects("tout")).toBeNull();
    expect(parseSampleRects(new Array(33).fill({ x: 0, y: 0, width: 1, height: 1 }))).toBeNull();
  });
});
