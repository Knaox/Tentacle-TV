import { describe, expect, it } from "vitest";
import { PURGE_CONFIRM_MS, confirmedDeletions, normalizeUserId } from "./accountPurge";

const live = new Set(["aaaa1111", "bbbb2222"]);
const HOUR = 3600_000;

describe("purge des comptes supprimés de Jellyfin", () => {
  it("un compte absent n'est purgé qu'au second relevé, assez tard", () => {
    const missing = new Map<string, number>();
    expect(confirmedDeletions(["aaaa1111", "cccc3333"], live, missing, 0)).toEqual([]);
    expect(confirmedDeletions(["aaaa1111", "cccc3333"], live, missing, PURGE_CONFIRM_MS / 2)).toEqual([]);
    expect(confirmedDeletions(["aaaa1111", "cccc3333"], live, missing, HOUR)).toEqual(["cccc3333"]);
  });

  it("un compte revenu entre deux relevés n'est pas purgé", () => {
    const missing = new Map<string, number>();
    confirmedDeletions(["dddd4444"], live, missing, 0);
    confirmedDeletions(["dddd4444"], new Set([...live, "dddd4444"]), missing, HOUR / 2);
    expect(confirmedDeletions(["dddd4444"], live, missing, HOUR)).toEqual([]);
  });

  it("le cache commun n'est jamais purgé ; les identifiants se comparent sans tirets ni casse", () => {
    const missing = new Map<string, number>();
    const known = ["__global__", "AAAA-1111"];
    confirmedDeletions(known, live, missing, 0);
    expect(confirmedDeletions(known, live, missing, HOUR)).toEqual([]);
    expect(normalizeUserId("AB-CD")).toBe("abcd");
  });

  it("un compte disparu des tables sort aussi des absences", () => {
    const missing = new Map<string, number>();
    confirmedDeletions(["eeee5555"], live, missing, 0);
    confirmedDeletions([], live, missing, HOUR / 2);
    expect(missing.size).toBe(0);
  });
});
