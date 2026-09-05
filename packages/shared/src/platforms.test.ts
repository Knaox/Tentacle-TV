import { describe, expect, it } from "vitest";
import {
  PLATFORMS,
  PLATFORM_FAMILIES,
  canonicalFamilyIds,
  expandFamilyIds,
  familyOfProviderName,
  matchesPlatformName,
  normalizePlatformName,
  resolvePlatformFamilies,
} from "./platforms";

function family(key: string) {
  const found = PLATFORM_FAMILIES.find((f) => f.key === key);
  if (!found) throw new Error(`famille inconnue : ${key}`);
  return found;
}

describe("normalizePlatformName", () => {
  it("retire accents et casse, lit « + » comme « plus »", () => {
    expect(normalizePlatformName("Canal+ Séries")).toBe("canal plus series");
    expect(normalizePlatformName("Apple TV+")).toBe("apple tv plus");
    expect(normalizePlatformName("  Cine+ OCS Amazon Channel ")).toBe("cine plus ocs amazon channel");
  });
});

describe("matchesPlatformName", () => {
  it("reconnaît les canaux et les renommages, en mots entiers", () => {
    expect(matchesPlatformName(family("appletv"), "Apple TV")).toBe(true);
    expect(matchesPlatformName(family("appletv"), "Apple TV Amazon Channel")).toBe(true);
    expect(matchesPlatformName(family("max"), "HBO Max Amazon Channel")).toBe(true);
    expect(matchesPlatformName(family("ocs"), "Cine+ OCS Amazon Channel ")).toBe(true);
    expect(matchesPlatformName(family("netflix"), "Netflix Standard with Ads")).toBe(true);
    expect(matchesPlatformName(family("adn"), "Animation Digital Network")).toBe(true);
    expect(matchesPlatformName(family("prime"), "Amazon Prime Video with Ads")).toBe(true);
  });

  it("refuse les boutiques et les faux amis", () => {
    expect(matchesPlatformName(family("appletv"), "Apple TV Store")).toBe(false);
    expect(matchesPlatformName(family("arte"), "ARTE Boutique")).toBe(false);
    expect(matchesPlatformName(family("canal"), "Canal VOD")).toBe(false);
    expect(matchesPlatformName(family("max"), "Cinemax")).toBe(false);
    expect(matchesPlatformName(family("ocs"), "DOCSVILLE")).toBe(false);
    expect(matchesPlatformName(family("prime"), "Amazon Video")).toBe(false);
  });
});

describe("familyOfProviderName", () => {
  it("la marque la plus tôt dans le nom l'emporte", () => {
    expect(familyOfProviderName("Paramount Plus Apple TV channel")?.key).toBe("paramount");
    expect(familyOfProviderName("Apple TV Amazon Channel")?.key).toBe("appletv");
    expect(familyOfProviderName("HBO Max")?.key).toBe("max");
    expect(familyOfProviderName("Apple TV Store")).toBeUndefined();
    expect(familyOfProviderName("Mubi")).toBeUndefined();
  });
});

describe("expandFamilyIds / canonicalFamilyIds", () => {
  it("élargit aux frères et canonise vers l'id principal", () => {
    expect(expandFamilyIds([283])).toEqual([283, 1968]);
    expect(expandFamilyIds([999])).toEqual([999]);
    expect(canonicalFamilyIds([1968, 283, 8])).toEqual([8, 283]);
    expect(canonicalFamilyIds([2100, 1796, 999])).toEqual([8, 119, 999]);
  });
});

describe("resolvePlatformFamilies", () => {
  const logos = { 283: "/crunchy.jpg", 685: "/ocs.jpg", 234: "/arte.jpg", 415: "/adn.jpg" };
  const fr = [
    { id: 8, name: "Netflix", logoPath: "/netflix.jpg" },
    { id: 350, name: "Apple TV", logoPath: "/apple.jpg" },
    { id: 2, name: "Apple TV Store", logoPath: "/store.jpg" },
    { id: 283, name: "Crunchyroll", logoPath: "/crunchy.jpg" },
    { id: 1968, name: "Crunchyroll Amazon Channel", logoPath: "/crunchy-amz.jpg" },
    { id: 234, name: "Arte", logoPath: "/arte.jpg" },
    { id: 685, name: "Cine+ OCS Amazon Channel ", logoPath: "/ocs.jpg" },
    { id: 1853, name: "Paramount Plus Apple TV channel", logoPath: "/paramount-apple.jpg" },
    { id: 1899, name: "HBO Max", logoPath: "/max.jpg" },
    { id: 415, name: "Animation Digital Network", logoPath: "/adn.jpg" },
  ];

  it("en France : OCS vit par 685, Arte par 234, Apple sans sa boutique", () => {
    const out = resolvePlatformFamilies(fr, logos);
    const keys = out.map((p) => p.family.key);
    expect(keys).toEqual(["netflix", "crunchyroll", "appletv", "paramount", "max", "adn", "ocs", "arte"]);
    const byKey = new Map(out.map((p) => [p.family.key, p]));
    expect(byKey.get("ocs")?.regionalIds).toEqual([685]);
    expect(byKey.get("ocs")?.logoPath).toBe("/ocs.jpg");
    expect(byKey.get("arte")?.regionalIds).toEqual([234]);
    expect(byKey.get("appletv")?.regionalIds).toEqual([350]);
    expect(byKey.get("appletv")?.logoPath).toBe("/apple.jpg");
    expect(byKey.get("crunchyroll")?.regionalIds).toEqual([283, 1968]);
    expect(byKey.get("paramount")?.regionalIds).toEqual([1853]);
  });

  it("en Suisse : ADN et OCS absents, Arte présent", () => {
    const ch = fr.filter((p) => p.id !== 415 && p.id !== 685);
    const keys = resolvePlatformFamilies(ch, logos).map((p) => p.family.key);
    expect(keys).not.toContain("adn");
    expect(keys).not.toContain("ocs");
    expect(keys).toContain("arte");
  });

  it("un canal reconnu par son nom seul rejoint sa famille", () => {
    const out = resolvePlatformFamilies([{ id: 4242, name: "Crunchyroll Swisscom Channel", logoPath: "/x.jpg" }], {});
    expect(out).toHaveLength(1);
    expect(out[0].family.key).toBe("crunchyroll");
    expect(out[0].regionalIds).toEqual([4242]);
    expect(out[0].logoPath).toBe("/x.jpg");
  });
});

describe("PLATFORMS (compat)", () => {
  it("porte les ids principaux corrigés", () => {
    expect(PLATFORMS).toHaveLength(11);
    expect(PLATFORMS.find((p) => p.name === "OCS")?.id).toBe(685);
    expect(PLATFORMS.find((p) => p.name === "Arte")?.id).toBe(234);
    expect(PLATFORMS.find((p) => p.name === "Crunchyroll")?.studioNames).toEqual(["Crunchyroll"]);
  });
});
