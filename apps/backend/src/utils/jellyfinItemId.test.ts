import { describe, expect, it } from "vitest";
import { isJellyfinItemId, jellyfinItemSegment } from "./jellyfinItemId";

describe("jellyfinItemId", () => {
  it("accepte un GUID avec ou sans tirets, en majuscules aussi", () => {
    expect(isJellyfinItemId("0123456789abcdef0123456789ABCDEF")).toBe(true);
    expect(isJellyfinItemId("01234567-89ab-cdef-0123-456789abcdef")).toBe(true);
  });

  it("refuse ce qui pourrait devenir un chemin ou des paramètres", () => {
    for (const id of ["", "..", "../Auth/Keys", "0123456789abcdef0123456789abcdef/..", "abc?x=1", "0123456789abcdef0123456789abcdeg"]) {
      expect(isJellyfinItemId(id)).toBe(false);
      expect(jellyfinItemSegment(id)).toBeNull();
    }
  });
});
