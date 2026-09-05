import { describe, expect, it } from "vitest";
import { PLATFORM_FAMILIES } from "@tentacle-tv/shared";
import { activeFamilyCount, buildPlatformCatalog, toggleFamily } from "./platformCatalog";

const FR = {
  region: "FR",
  providers: [
    { id: 8, name: "Netflix", logoPath: "/n.jpg" },
    { id: 350, name: "Apple TV", logoPath: "/apple.jpg" },
    { id: 685, name: "Cine+ OCS Amazon Channel ", logoPath: "/ocs-amz.jpg" },
    { id: 234, name: "Arte", logoPath: "/arte.jpg" },
    { id: 415, name: "Animation Digital Network", logoPath: "/adn.jpg" },
    { id: 1899, name: "HBO Max", logoPath: "/max.jpg" },
  ],
  logos: { 8: "/n.jpg", 350: "/apple.jpg", 685: "/ocs-amz.jpg", 234: "/arte.jpg", 415: "/adn.jpg", 1899: "/max.jpg", 283: "/crunchy.jpg" },
};

describe("buildPlatformCatalog", () => {
  it("ne montre que les familles présentes dans la région, avec un logo", () => {
    const catalog = buildPlatformCatalog(PLATFORM_FAMILIES, FR);
    expect(catalog.map((e) => e.key)).toEqual(["netflix", "appletv", "max", "adn", "ocs", "arte"]);
    for (const entry of catalog) expect(entry.logoPath).not.toBeNull();
    expect(catalog.find((e) => e.key === "ocs")).toMatchObject({ id: 685, logoPath: "/ocs-amz.jpg" });
    expect(catalog.find((e) => e.key === "arte")).toMatchObject({ id: 234, logoPath: "/arte.jpg" });
  });

  it("sans annuaire : toutes les familles, logo de la carte s'il existe", () => {
    const catalog = buildPlatformCatalog(PLATFORM_FAMILIES, undefined);
    expect(catalog).toHaveLength(PLATFORM_FAMILIES.length);
    expect(catalog.every((e) => e.logoPath === null)).toBe(true);
    const withLogos = buildPlatformCatalog(PLATFORM_FAMILIES, { region: "FR", providers: [], logos: { 283: "/c.jpg" } });
    expect(withLogos.find((e) => e.key === "crunchyroll")?.logoPath).toBe("/c.jpg");
  });
});

describe("sélection", () => {
  it("bascule l'id principal et compte les familles actives", () => {
    const catalog = buildPlatformCatalog(PLATFORM_FAMILIES, FR);
    const netflix = catalog[0];
    const on = toggleFamily([], netflix);
    expect(on).toEqual([8]);
    expect(activeFamilyCount(catalog, on)).toBe(1);
    expect(toggleFamily(on, netflix)).toEqual([]);
  });
});
