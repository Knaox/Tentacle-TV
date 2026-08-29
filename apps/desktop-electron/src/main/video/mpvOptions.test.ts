import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Le socle anti-scripts n'est pas une préférence : sans lui, le paquet Mac App
 * Store est TUÉ à la première lecture (LuaJIT écrit du code machine, la
 * signature durcie l'interdit). Ces tests gardent les deux propriétés dont
 * dépend cette garantie : les options sont posées, et elles sont posées EN
 * DERNIER — une page qui renverrait `ytdl=yes` ne doit pas pouvoir les défaire.
 */

// `vi.hoisted` : la fabrique de `vi.mock` est remontée AU-DESSUS des imports,
// elle ne peut donc pas fermer sur une variable ordinaire de ce module.
const { applied, refused } = vi.hoisted(() => ({
  applied: [] as Array<[string, string]>,
  refused: new Set<string>(),
}));

vi.mock("./mpvFfi", () => ({
  mpvApi: () => ({
    setOptionString: (_ctx: unknown, name: string, value: string) => {
      applied.push([name, value]);
      return refused.has(name) ? -5 : 0;
    },
  }),
}));

import { applyOptions } from "./mpvOptions";

beforeEach(() => {
  applied.length = 0;
  refused.clear();
});

describe("poserOptions", () => {
  it("coupe tous les scripts que mpv 0.40 charge de lui-même", () => {
    applyOptions(null, {});
    const appliedMap = new Map(applied);
    for (const option of [
      "load-scripts",
      "load-auto-profiles",
      "load-osd-console",
      "load-stats-overlay",
      "load-select",
      "load-positioning",
      "load-commands",
      "ytdl",
      "osc",
    ]) {
      expect(appliedMap.get(option), option).toBe("no");
    }
    expect(appliedMap.get("scripts")).toBe("");
  });

  it("passe les options de la page, et garde le dernier mot", () => {
    applyOptions(null, { hwdec: "auto-safe", ytdl: "yes", osc: "yes" });

    expect(applied).toContainEqual(["hwdec", "auto-safe"]);
    // La page a demandé les scripts ; c'est le socle qui parle en dernier, donc
    // c'est lui que mpv retient.
    const last = (name: string) => [...applied].reverse().find(([k]) => k === name)?.[1];
    expect(last("ytdl")).toBe("no");
    expect(last("osc")).toBe("no");
  });

  it("traduit les booléens de la page comme mpv les attend", () => {
    applyOptions(null, { "keep-open": true, "input-default-bindings": false });

    expect(applied).toContainEqual(["keep-open", "yes"]);
    expect(applied).toContainEqual(["input-default-bindings", "no"]);
  });

  it("dit au journal quelle option un libmpv refuse, sans jamais lever", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    refused.add("hwdec");

    expect(() => applyOptions(null, { hwdec: "auto-safe" })).not.toThrow();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("hwdec=auto-safe"));
    // Une option acceptée, elle, ne fait pas de bruit.
    expect(warn.mock.calls.filter(([m]) => String(m).includes("keep-open"))).toHaveLength(0);
    warn.mockRestore();
  });
});
