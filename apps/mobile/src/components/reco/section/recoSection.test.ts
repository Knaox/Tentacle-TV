import { describe, expect, it } from "vitest";
import { recoSectionOf } from "./recoSection";

describe("recoSectionOf", () => {
  it("ouvre « Affiner » sur section=refine, même répété dans l'URL", () => {
    expect(recoSectionOf("refine")).toBe("refine");
    expect(recoSectionOf(["refine", "forYou"])).toBe("refine");
  });

  it("rend « Pour vous » sans paramètre ou sur une valeur inconnue", () => {
    expect(recoSectionOf(undefined)).toBe("forYou");
    expect(recoSectionOf("swipe")).toBe("forYou");
  });
});
