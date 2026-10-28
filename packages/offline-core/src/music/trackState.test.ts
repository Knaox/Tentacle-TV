import { describe, expect, it } from "vitest";
import { trackState } from "./trackState";

const lib = { availability: "library" as const, jellyfinId: "a".repeat(32) };
const ext = { availability: "remote" as const, jellyfinId: null };

describe("l'état d'un titre (une règle pour toutes les rangées)", () => {
  it("dans la bibliothèque, pas sur l'appareil : bibliothèque", () => {
    expect(trackState({ ...lib, keptStage: "none" })).toBe("library");
  });
  it("hors bibliothèque (lu depuis l'extension, attente, cache) : cloud", () => {
    expect(trackState({ ...ext, keptStage: "none" })).toBe("cloud");
    expect(trackState({ availability: "pending", jellyfinId: null, keptStage: "none" })).toBe("cloud");
    expect(trackState({ availability: "cache", jellyfinId: null, keptStage: "none" })).toBe("cloud");
  });
  it("une copie complète l'emporte sur l'origine, d'où qu'il vienne", () => {
    expect(trackState({ ...lib, keptStage: "complete" })).toBe("kept");
    expect(trackState({ ...ext, keptStage: "complete" })).toBe("kept");
  });
  it("demandé, pas encore là : en route ; en défaut : dit comme tel", () => {
    for (const stage of ["waiting", "preparing", "transferring"] as const) expect(trackState({ ...lib, keptStage: stage })).toBe("keeping");
    expect(trackState({ ...ext, keptStage: "failed" })).toBe("keepFailed");
  });
  it("indisponible : passe avant l'origine, jamais avant une copie complète", () => {
    expect(trackState({ ...ext, keptStage: "none", unavailable: true })).toBe("unavailable");
    expect(trackState({ ...ext, keptStage: "complete", unavailable: true })).toBe("kept");
  });
  it("un identifiant Jellyfin sans disponibilité « bibliothèque » n'est pas la bibliothèque", () => {
    expect(trackState({ availability: "remote", jellyfinId: "b".repeat(32), keptStage: "none" })).toBe("cloud");
  });
});
