import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  LICENSE_PLATFORMS, LICENSE_TEXT_TITLES, THIRD_PARTY_COMPONENTS,
  componentsFor, componentsUnder, licenseTextsFor, tentacleSourceUrl,
} from "./index";
import { LICENSE_TEXTS } from "./texts";

const here = __dirname;
const repo = join(here, "..", "..", "..", "..");

describe("textes de licence", () => {
  it("le module généré reprend les fichiers à l'octet près", () => {
    for (const file of readdirSync(join(here, "texts")).filter((f) => f.endsWith(".txt"))) {
      const id = file.slice(0, -4) as keyof typeof LICENSE_TEXTS;
      expect(LICENSE_TEXTS[id], file).toBe(readFileSync(join(here, "texts", file), "utf8"));
    }
    expect(LICENSE_TEXTS["Tentacle-TV-Exceptions"]).toBe(readFileSync(join(repo, "LICENSE-EXCEPTIONS"), "utf8"));
    expect(LICENSE_TEXTS.PrismCore).toBe(readFileSync(join(repo, "apps/tv/ios/Vendor/PrismCore/LICENSE"), "utf8"));
  });

  it("le LICENSE du dépôt est le texte officiel de l'AGPL v3", () => {
    expect(readFileSync(join(repo, "LICENSE"), "utf8")).toBe(LICENSE_TEXTS["AGPL-3.0"]);
    expect(LICENSE_TEXTS["AGPL-3.0"]).toContain("GNU AFFERO GENERAL PUBLIC LICENSE");
  });

  it("chaque texte a un titre, et chaque titre un texte", () => {
    expect(Object.keys(LICENSE_TEXT_TITLES).sort()).toEqual(Object.keys(LICENSE_TEXTS).sort());
  });
});

describe("catalogue des composants", () => {
  it("chaque composant cite des textes connus, une source et au moins une plateforme", () => {
    for (const c of THIRD_PARTY_COMPONENTS) {
      for (const id of c.texts) expect(LICENSE_TEXTS[id], `${c.name} → ${id}`).toBeTruthy();
      expect(c.source.length, c.name).toBeGreaterThan(0);
      expect(c.platforms.length, c.name).toBeGreaterThan(0);
    }
  });

  it("aucun composant GPL sur l'App Store (iPhone, Apple TV), ni sur le mobile Android (Firebase)", () => {
    for (const platform of ["ios", "tvos", "android"] as const) {
      for (const c of componentsFor(platform)) {
        expect(/(^|[^L])GPL/.test(c.license.replace(/LGPL/g, "")), `${platform} : ${c.name} (${c.license})`).toBe(false);
      }
    }
  });

  it("toute plateforme embarque l'AGPL et les permissions de Tentacle TV, en tête", () => {
    for (const platform of LICENSE_PLATFORMS) {
      expect(licenseTextsFor(platform).slice(0, 2)).toEqual(["AGPL-3.0", "Tentacle-TV-Exceptions"]);
    }
  });

  it("la LGPL v3 vient toujours avec la GPL v3 qu'elle complète", () => {
    for (const platform of LICENSE_PLATFORMS) {
      const texts = licenseTextsFor(platform);
      if (texts.includes("LGPL-3.0")) expect(texts, platform).toContain("GPL-3.0");
    }
  });

  it("l'Apple TV porte le texte de PrismCore (exigé par son exception App Store)", () => {
    expect(licenseTextsFor("tvos")).toContain("PrismCore");
    expect(componentsUnder("tvos", "PrismCore").map((c) => c.name)).toEqual(["PrismCore"]);
    expect(licenseTextsFor("ios")).not.toContain("PrismCore");
  });

  it("mobile : aucun texte lisible ne contient le mot interdit (règle des relecteurs d'Apple)", () => {
    const forbidden = /t[ée]l[ée]charg|download/i;
    for (const platform of ["ios", "android"] as const) {
      for (const id of licenseTextsFor(platform)) expect(forbidden.test(LICENSE_TEXTS[id]), id).toBe(false);
      for (const c of componentsFor(platform)) {
        expect(forbidden.test([c.name, c.notice, c.note, c.source].join(" ")), c.name).toBe(false);
      }
    }
  });

  it("FreeType porte sa mention de crédit obligatoire là où il est embarqué", () => {
    for (const c of THIRD_PARTY_COMPONENTS.filter((x) => x.license === "FTL")) {
      expect(c.notice).toContain("The FreeType Project");
    }
  });
});

describe("source de Tentacle TV", () => {
  it("pointe le tag de la plateforme, sinon le dépôt", () => {
    expect(tentacleSourceUrl("tvos", "1.10.1")).toBe("https://github.com/Knaox/Tentacle-TV/tree/tv-v1.10.1");
    expect(tentacleSourceUrl("ios", "1.11.0")).toBe("https://github.com/Knaox/Tentacle-TV/tree/mobile-v1.11.0");
    expect(tentacleSourceUrl("web", "1.24.0")).toBe("https://github.com/Knaox/Tentacle-TV/tree/server-v1.24.0");
    expect(tentacleSourceUrl("macos", null)).toBe("https://github.com/Knaox/Tentacle-TV");
  });
});
