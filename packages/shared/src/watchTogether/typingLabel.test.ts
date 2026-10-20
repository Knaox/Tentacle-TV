import { describe, expect, it } from "vitest";
import { typingLabelKey } from "./typingLabel";

describe("typingLabelKey", () => {
  it("personne, un, deux, plusieurs", () => {
    expect(typingLabelKey([])).toBeNull();
    expect(typingLabelKey([{ username: "Alice" }])).toEqual({ key: "typingOne", params: { name: "Alice" } });
    expect(typingLabelKey([{ username: "Alice" }, { username: "Bob" }]))
      .toEqual({ key: "typingTwo", params: { a: "Alice", b: "Bob" } });
    expect(typingLabelKey([{ username: "Alice" }, { username: "Bob" }, { username: "Chloé" }]))
      .toEqual({ key: "typingMany", params: { name: "Alice", count: 2 } });
  });
});
