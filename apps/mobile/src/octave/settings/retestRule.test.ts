import { describe, expect, it } from "vitest";
import { retestLine } from "./retestRule";

describe("« Retester la connexion »", () => {
  it("n'existe qu'hors ligne", () => {
    expect(retestLine("online", false, false)).toBe("hidden");
    expect(retestLine("checking", false, true)).toBe("hidden");
  });
  it("dit le test en cours, quel que soit le mode", () => {
    expect(retestLine("offline-auto", true, false)).toBe("checking");
    expect(retestLine("offline-manual", true, false)).toBe("checking");
  });
  it("hors ligne subi : invite, puis dit que le serveur ne répond toujours pas", () => {
    expect(retestLine("offline-auto", false, false)).toBe("idle");
    expect(retestLine("offline-auto", false, true)).toBe("still");
  });
  it("hors ligne par choix : dit que le test quitte ce mode", () => {
    expect(retestLine("offline-manual", false, false)).toBe("idleManual");
  });
});
