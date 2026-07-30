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
const { posees } = vi.hoisted(() => ({ posees: [] as Array<[string, string]> }));

vi.mock("./mpvFfi", () => ({
  mpvApi: () => ({
    setOptionString: (_ctx: unknown, nom: string, valeur: string) => {
      posees.push([nom, valeur]);
      return 0;
    },
  }),
}));

import { poserOptions } from "./mpvOptions";

beforeEach(() => {
  posees.length = 0;
});

describe("poserOptions", () => {
  it("coupe tous les scripts que mpv 0.40 charge de lui-même", () => {
    poserOptions(null, {});
    const posé = new Map(posees);
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
      expect(posé.get(option), option).toBe("no");
    }
    expect(posé.get("scripts")).toBe("");
  });

  it("passe les options de la page, et garde le dernier mot", () => {
    poserOptions(null, { hwdec: "auto-safe", ytdl: "yes", osc: "yes" });

    expect(posees).toContainEqual(["hwdec", "auto-safe"]);
    // La page a demandé les scripts ; c'est le socle qui parle en dernier, donc
    // c'est lui que mpv retient.
    const dernier = (nom: string) => [...posees].reverse().find(([k]) => k === nom)?.[1];
    expect(dernier("ytdl")).toBe("no");
    expect(dernier("osc")).toBe("no");
  });

  it("traduit les booléens de la page comme mpv les attend", () => {
    poserOptions(null, { "keep-open": true, "input-default-bindings": false });

    expect(posees).toContainEqual(["keep-open", "yes"]);
    expect(posees).toContainEqual(["input-default-bindings", "no"]);
  });
});
