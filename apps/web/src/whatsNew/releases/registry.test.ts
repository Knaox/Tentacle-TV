import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { i18n, initI18n, isServerCapability, resolveServerCapabilities } from "@tentacle-tv/shared";
import { isNewerVersion } from "../../lib/updateCheckers";
import { forAudience, forClient, forServer, selectWhatsNewFeatures } from "../selectFeatures";
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

  it("une capacité exigée est une clé connue du contrat", () => {
    for (const release of WHATS_NEW_RELEASES) {
      for (const feature of release.features) {
        if (feature.capability !== undefined) expect(isServerCapability(feature.capability), feature.id).toBe(true);
      }
    }
  });

  it("1.30.0 : l'aperçu, les profils, le code PIN, le contrôle parental, « Vous regardez encore ? », le bandeau, la cloche et les droits exigent leur capacité, la galerie aucune — face à un serveur muet, la galerie seule", () => {
    const release = WHATS_NEW_RELEASES.find((r) => r.version === "1.30.0");
    expect(release?.features.map((f) => f.capability)).toEqual([
      "trailers.preview", "family.desktopProfiles", "family.desktopProfiles", "family.parentalControls", "playback.stillWatching", undefined,
      "home.heroRecoKinds", "notifications.targets", "admin.userRights",
    ]);
    const mute = resolveServerCapabilities({ version: "1.23.0" });
    const alone = selectWhatsNewFeatures("1.30.0", "1.28.2", forServer(WHATS_NEW_RELEASES, mute)).features;
    expect(alone.map((f) => f.id)).toEqual(["avatars"]);
    const capable = resolveServerCapabilities({
      capabilities: [
        "trailers.preview", "family.desktopProfiles", "family.parentalControls", "playback.stillWatching", "home.heroRecoKinds",
        "notifications.targets", "admin.userRights",
      ],
    });
    const shown = selectWhatsNewFeatures("1.30.0", "1.28.2", forServer(WHATS_NEW_RELEASES, capable)).features;
    expect(shown.map((f) => f.id)).toEqual([
      "trailerPreview", "profiles", "familyPin", "guestParental", "stillWatching", "avatars", "heroSource", "notifications", "userRights",
    ]);
    // Les droits des comptes ne parlent qu'aux administrateurs.
    const member = selectWhatsNewFeatures("1.30.0", "1.28.2", forAudience(forServer(WHATS_NEW_RELEASES, capable), false)).features;
    expect(member.map((f) => f.id)).not.toContain("userRights");
    // Sans les profils du bureau, le code PIN conseillé se tait avec eux.
    const noProfiles = resolveServerCapabilities({ capabilities: ["trailers.preview", "playback.stillWatching"] });
    const partial = selectWhatsNewFeatures("1.30.0", "1.28.2", forServer(WHATS_NEW_RELEASES, noProfiles)).features;
    expect(partial.map((f) => f.id)).toEqual(["trailerPreview", "stillWatching", "avatars"]);
    // Sans les sources par genre, la fiche du bandeau se tait : Personnalisation ne les propose pas.
    expect(partial.map((f) => f.id)).not.toContain("heroSource");
  });

  it("1.40.0 : le Liquid Glass n'existe qu'avec le trait `liquidGlass` — ailleurs, la release est vide et rien ne s'ouvre", () => {
    const release = WHATS_NEW_RELEASES.find((r) => r.version === "1.40.0");
    const glass = release?.features.filter((f) => f.requires === "liquidGlass").map((f) => f.id);
    expect(glass).toEqual(["glassNavigation", "glassPlayer"]);
    const elsewhere = selectWhatsNewFeatures("1.40.0", "1.31.1", forClient(WHATS_NEW_RELEASES, new Set())).features;
    expect(elsewhere.map((f) => f.id)).not.toContain("glassNavigation");
    expect(elsewhere.map((f) => f.id)).not.toContain("glassPlayer");
    const onTahoe = selectWhatsNewFeatures("1.40.0", "1.31.1", forClient(WHATS_NEW_RELEASES, new Set(["liquidGlass"] as const))).features;
    expect(onTahoe.slice(0, 2).map((f) => f.id)).toEqual(["glassNavigation", "glassPlayer"]);
  });
});
