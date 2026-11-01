import { describe, expect, it } from "vitest";
import { keptCapability } from "./keptCapability";

describe("keptCapability", () => {
  it("déclarée : oui", () => expect(keptCapability(true, true, false)).toBe(true));
  it("hors ligne (config inconnue) avec la page gardée de ce serveur : oui", () => expect(keptCapability(false, false, true)).toBe(true));
  it("hors ligne sans page gardée : non", () => expect(keptCapability(false, false, false)).toBe(false));
  it("un serveur d'avant qui a RÉPONDU sans la capacité : non, même avec une page d'avant", () => expect(keptCapability(false, true, true)).toBe(false));
});
