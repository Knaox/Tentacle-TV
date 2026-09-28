import { describe, expect, it } from "vitest";
import { recoSectionOf } from "./recoSections";

describe("recoSectionOf", () => {
  it("reconnaît la section Affiner, barre finale comprise", () => {
    expect(recoSectionOf("/recommendations/refine")).toBe("refine");
    expect(recoSectionOf("/recommendations/refine/")).toBe("refine");
  });

  it("rend « Pour vous » partout ailleurs", () => {
    expect(recoSectionOf("/recommendations")).toBe("forYou");
    expect(recoSectionOf("/recommendations/other")).toBe("forYou");
    expect(recoSectionOf("/swipe")).toBe("forYou");
  });
});
