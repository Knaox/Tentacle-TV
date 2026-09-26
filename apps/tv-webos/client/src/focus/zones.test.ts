import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Le rail sous un piège : une modale le tient à l'écart, la recherche le
 * laisse passer. Un élément factice suffit — seule sa marque est lue.
 */

class FakeElement {
  constructor(private readonly marks: string[] = []) {}
  hasAttribute(name: string): boolean {
    return this.marks.includes(name);
  }
}

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("Element", FakeElement);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("rail atteignable", () => {
  it("l'est toujours hors de tout piège", async () => {
    const { railReachable } = await import("./zones");
    expect(railReachable(null)).toBe(true);
  });

  it("ne l'est pas sous un dialogue ordinaire", async () => {
    const { railReachable } = await import("./zones");
    expect(railReachable(new FakeElement() as unknown as ParentNode)).toBe(false);
  });

  it("l'est sous un piège qui le déclare", async () => {
    const { railReachable, RAIL_REACHABLE_ATTRIBUTE } = await import("./zones");
    const trap = new FakeElement([RAIL_REACHABLE_ATTRIBUTE]) as unknown as ParentNode;
    expect(railReachable(trap)).toBe(true);
  });
});
