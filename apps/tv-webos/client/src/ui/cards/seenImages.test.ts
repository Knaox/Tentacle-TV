import { beforeEach, describe, expect, it, vi } from "vitest";

/** Une `Image` de test : on veut seulement savoir quelle adresse elle porte. */
const holders: { src: string }[] = [];
class FakeImage {
  src = "";
  constructor() {
    holders.push(this);
  }
}

async function load() {
  vi.resetModules();
  return import("./seenImages");
}

describe("seenImages", () => {
  beforeEach(() => {
    holders.length = 0;
    vi.stubGlobal("Image", FakeImage);
  });

  it("dit prête une image arrivée, et pas une autre", async () => {
    const { knownImage, rememberImage } = await load();
    expect(knownImage("a")).toBe(false);
    rememberImage("a");
    expect(knownImage("a")).toBe(true);
    expect(knownImage("b")).toBe(false);
  });

  it("garde la ressource vivante par une Image qui porte son adresse", async () => {
    const { rememberImage } = await load();
    rememberImage("a");
    expect(holders.map((h) => h.src)).toEqual(["a"]);
  });

  it("ne refait pas de porteur pour une image déjà retenue", async () => {
    const { rememberImage } = await load();
    rememberImage("a");
    rememberImage("a");
    expect(holders).toHaveLength(1);
  });

  it("relâche la moins récemment vue au-delà de deux cents", async () => {
    const { knownImage, rememberImage } = await load();
    for (let i = 0; i < 200; i++) rememberImage(`u${i}`);
    // Revue : elle redevient la plus récente, c'est la suivante qui sort.
    rememberImage("u0");
    rememberImage("u200");
    expect(knownImage("u0")).toBe(true);
    expect(knownImage("u1")).toBe(false);
    expect(knownImage("u200")).toBe(true);
  });
});
