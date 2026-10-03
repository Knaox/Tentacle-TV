import { describe, expect, it } from "vitest";
import { groupEntryKey, rememberGroupFocus } from "./groupEntry";

const mountedOf = (...keys: string[]) => (key: string) => keys.includes(key);

describe("groupEntry — l'entrée d'un groupe", () => {
  it("le dernier élément visité, s'il est encore monté", () => {
    expect(groupEntryKey({ remember: true, last: "episode:4", isMounted: mountedOf("episode:4"), fallback: () => "episode:0" })).toBe("episode:4");
  });

  it("sinon l'entrée par défaut, relue au moment de la décision", () => {
    let fallback = "season:1";
    const input = { remember: true, last: "season:3", isMounted: mountedOf(), fallback: () => fallback };
    expect(groupEntryKey(input)).toBe("season:1");
    fallback = "season:2";
    expect(groupEntryKey(input)).toBe("season:2");
  });

  it("un groupe qui ne se souvient pas entre toujours par défaut", () => {
    expect(groupEntryKey({ remember: false, last: "row:5", isMounted: mountedOf("row:5"), fallback: () => "row:0" })).toBe("row:0");
  });

  it("aucune cible : null", () => {
    expect(groupEntryKey({ remember: true, last: null, isMounted: mountedOf(), fallback: () => null })).toBeNull();
  });

  it("seul un focus d'une clé du groupe devient le dernier visité", () => {
    const owns = (key: string) => key.startsWith("episode:");
    expect(rememberGroupFocus(null, "episode:2", owns)).toBe("episode:2");
    expect(rememberGroupFocus("episode:2", "season:0", owns)).toBe("episode:2");
  });
});
