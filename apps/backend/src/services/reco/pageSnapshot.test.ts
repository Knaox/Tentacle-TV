import { describe, expect, it, vi } from "vitest";

vi.mock("../db", () => ({ getPrisma: () => ({}) }));

import { filterKeyOfRowKey, pickSnapshotsToEvict, snapshotRowKey } from "./pageSnapshot";

const at = (iso: string) => new Date(iso);

describe("pickSnapshotsToEvict", () => {
  it("garde « all » et les clés « une famille », borne les sélections multiples aux quatre plus récentes", () => {
    const victims = pickSnapshotsToEvict([
      { filterKey: "all", expiresAt: at("2026-01-01T00:00:00Z") },
      { filterKey: "8", expiresAt: at("2026-01-01T00:00:00Z") },
      { filterKey: "283", expiresAt: at("2026-01-01T00:00:00Z") },
      { filterKey: "8+283", expiresAt: at("2026-09-05T00:00:00Z") },
      { filterKey: "283+415", expiresAt: at("2026-09-04T00:00:00Z") },
      { filterKey: "119+337", expiresAt: at("2026-09-03T00:00:00Z") },
      { filterKey: "337+415", expiresAt: at("2026-09-02T00:00:00Z") },
      { filterKey: "8+119", expiresAt: at("2026-09-01T00:00:00Z") },
      { filterKey: "8+415", expiresAt: at("2026-09-01T00:00:00Z") },
    ]);
    expect(victims).toEqual(["8+119", "8+415"]);
  });

  it("rien à évincer sous la borne", () => {
    expect(pickSnapshotsToEvict([{ filterKey: "all", expiresAt: at("2026-09-01T00:00:00Z") }])).toEqual([]);
  });
});

describe("snapshotRowKey", () => {
  it("préfixe, aller-retour, et refuse une clé qui ne tient pas dans VarChar(64)", () => {
    expect(snapshotRowKey("283+415")).toBe("page:283+415");
    expect(filterKeyOfRowKey("page:283+415")).toBe("283+415");
    expect(filterKeyOfRowKey("pool")).toBeNull();
    expect(() => snapshotRowKey("1".repeat(60))).toThrow();
  });
});
