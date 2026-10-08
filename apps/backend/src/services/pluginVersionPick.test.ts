import { describe, expect, it } from "vitest";
import { isCompatibleWith, pickVersion } from "./pluginVersionPick";
import { normalizePlugins, type RawRegistryEntry } from "./pluginManager";

/*
 * Le registre garde `latestVersion` sur ce que TOUT serveur peut prendre (un
 * 1.24 ne lit que lui) ; un serveur d'aujourd'hui choisit la plus récente qui
 * lui convient, et ne propose jamais une version qui exige plus récent que lui.
 */

const v = (version: string, minTentacleVersion?: string) => ({
  version, minTentacleVersion, downloadUrl: `https://registry.test/vigie-${version}.tgz`, checksum: `sha256:${version}`,
});

const VIGIE: RawRegistryEntry = {
  id: "seer", name: "Vigie", latestVersion: "1.24.2",
  versions: [v("1.24.1", "0.9.0"), v("1.24.2", "0.9.0"), v("1.25.0", "1.25.0"), v("1.26.0", "1.26.0")],
};

describe("compatibilité d'une version", () => {
  it("sans exigence : compatible ; sinon, le serveur doit l'atteindre", () => {
    expect(isCompatibleWith("1.24.0", undefined)).toBe(true);
    expect(isCompatibleWith("1.25.0", "1.25.0")).toBe(true);
    expect(isCompatibleWith("1.24.9", "1.25.0")).toBe(false);
  });

  it("la plus récente compatible, et la plus récente trop récente", () => {
    const pick = pickVersion(VIGIE.versions!, "1.25.0");
    expect(pick.chosen?.version).toBe("1.25.0");
    expect(pick.tooNew?.version).toBe("1.26.0");
    expect(pickVersion(VIGIE.versions!, "1.30.0")).toMatchObject({ chosen: { version: "1.26.0" }, tooNew: undefined });
  });
});

describe("le catalogue vu par chaque serveur", () => {
  it("un 1.25 prend la 1.25.0 — son archive, son empreinte —, et sait qu'une plus récente l'attend", () => {
    const [entry] = normalizePlugins([VIGIE], "1.25.0");
    expect(entry).toMatchObject({
      version: "1.25.0", downloadUrl: "https://registry.test/vigie-1.25.0.tgz", checksum: "sha256:1.25.0",
      minAppVersion: "1.25.0", newerRequires: { version: "1.26.0", minTentacleVersion: "1.26.0" },
    });
    expect(entry.incompatible).toBeUndefined();
  });

  it("un serveur plus ancien reste sur la ligne compatible", () => {
    const [entry] = normalizePlugins([VIGIE], "1.24.0");
    expect(entry).toMatchObject({ version: "1.24.2", checksum: "sha256:1.24.2" });
  });

  it("rien de compatible : la version annoncée, marquée incompatible", () => {
    const [entry] = normalizePlugins([{ id: "x", name: "X", latestVersion: "2.0.0", versions: [v("2.0.0", "9.0.0")] }], "1.25.0");
    expect(entry).toMatchObject({ version: "2.0.0", incompatible: true, minAppVersion: "9.0.0" });
  });

  it("une entrée sans `versions` garde ses champs de premier niveau, compatible", () => {
    const [entry] = normalizePlugins([{ id: "y", name: "Y", version: "1.0.0", downloadUrl: "https://registry.test/y.tgz" } as RawRegistryEntry], "1.25.0");
    expect(entry).toMatchObject({ version: "1.0.0", downloadUrl: "https://registry.test/y.tgz" });
    expect(entry.incompatible).toBeUndefined();
  });
});
