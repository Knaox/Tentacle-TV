import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { i18n, initI18n } from "@tentacle-tv/shared";
import { isNewerVersion } from "../../lib/updateCheckers";
import { WHATS_NEW_RELEASES } from "./index";

// La source unique des versions, lue telle quelle : le garde-fou porte sur le
// fichier que la CI lit, pas sur la constante que Vite en dérive.
const versions = JSON.parse(
  readFileSync(new URL("../../../../../versions.json", import.meta.url), "utf8"),
) as { desktop: string };

function bundle(lng: "fr" | "en"): Record<string, unknown> {
  initI18n();
  return (i18n.getResourceBundle(lng, "whatsNew") ?? {}) as Record<string, unknown>;
}

describe("registre de l'écran de nouveautés", () => {
  it("la version desktop courante a son entrée (vide acceptée)", () => {
    expect(WHATS_NEW_RELEASES.some((r) => r.version === versions.desktop)).toBe(true);
  });

  it("versions uniques, du plus récent au plus ancien", () => {
    const list = WHATS_NEW_RELEASES.map((r) => r.version);
    expect(new Set(list).size).toBe(list.length);
    for (let i = 1; i < list.length; i++) {
      expect(isNewerVersion(list[i - 1], list[i]), `${list[i - 1]} > ${list[i]}`).toBe(true);
    }
  });

  it("ids uniques par release, routes absolues, textes présents en FR et en EN", () => {
    const fr = bundle("fr");
    const en = bundle("en");
    for (const release of WHATS_NEW_RELEASES) {
      const ids = release.features.map((f) => f.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const feature of release.features) {
        expect(feature.id).not.toMatch(/_(one|other|zero|plural)$/);
        if (feature.route !== undefined) expect(feature.route.startsWith("/")).toBe(true);
        for (const key of [feature.titleKey, feature.bodyKey]) {
          expect(typeof fr[key], `${key} (fr)`).toBe("string");
          expect(typeof en[key], `${key} (en)`).toBe("string");
        }
      }
    }
  });
});
