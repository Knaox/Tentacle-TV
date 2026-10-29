import { describe, expect, it } from "vitest";
import { rowClickAction } from "./rowClick";

describe("rowClickAction", () => {
  it("le titre en cours de la même liste : pause ou reprise, jamais un redémarrage", () => {
    expect(rowClickAction("a", "a", "album:1", "album:1")).toBe("toggle");
  });
  it("un autre titre, ou le même titre dans une autre liste : la liste part de lui", () => {
    expect(rowClickAction("b", "a", "album:1", "album:1")).toBe("play");
    expect(rowClickAction("a", "a", "playlist:2", "album:1")).toBe("play");
    expect(rowClickAction(undefined, null, null, "album:1")).toBe("play");
  });
});
