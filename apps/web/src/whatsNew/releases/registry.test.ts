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

  it("1.40.0 : Octave EN TÊTE, seulement face à un serveur qui déclare music.library — sinon la nouveauté n'existe pas", () => {
    const release = WHATS_NEW_RELEASES.find((r) => r.version === "1.40.0");
    const octave = release?.features[0];
    expect(octave?.id).toBe("octave");
    expect(octave?.capability).toBe("music.library");
    expect(octave?.route).toBe("/octave");
    expect(octave?.requires).toBeUndefined();
    const glass = new Set(["liquidGlass", "liquidGlassPlayer"] as const);
    // Un serveur d'avant (1.31) : pas d'Octave, le verre seul.
    const before = resolveServerCapabilities({ capabilities: ["trailers.preview"] });
    const old = selectWhatsNewFeatures("1.40.0", "1.31.2", forClient(forServer(WHATS_NEW_RELEASES, before), glass)).features;
    expect(old.map((f) => f.id)).toEqual(["glassNavigation", "glassPlayer"]);
    // Un serveur muet (≤ 1.23) non plus.
    const mute = selectWhatsNewFeatures("1.40.0", "1.31.2", forServer(WHATS_NEW_RELEASES, resolveServerCapabilities({ version: "1.23.0" }))).features;
    expect(mute.map((f) => f.id)).not.toContain("octave");
    // Un serveur 1.40 : Octave d'abord, avant le verre.
    const v140 = resolveServerCapabilities({ capabilities: ["music.library"] });
    const shown = selectWhatsNewFeatures("1.40.0", "1.31.2", forClient(forServer(WHATS_NEW_RELEASES, v140), glass)).features;
    expect(shown.map((f) => f.id)).toEqual(["octave", "glassNavigation", "glassPlayer"]);
    // Sans le verre (Windows, Linux, un Mac d'avant Tahoe) : Octave seul.
    const windows = selectWhatsNewFeatures("1.40.0", "1.31.2", forClient(forServer(WHATS_NEW_RELEASES, v140), new Set())).features;
    expect(windows.map((f) => f.id)).toEqual(["octave"]);
  });

  it("1.40.0 : les mots d'Octave parlent d'un lecteur pour la bibliothèque personnelle, jamais d'une source ni d'un transfert", () => {
    for (const lng of ["fr", "en"] as const) {
      const texts = `${bundle(lng)["v1_40_0_octave_title"]} ${bundle(lng)["v1_40_0_octave_body"]}`;
      expect(texts).not.toMatch(/t[ée]l[ée]charg|download|extension|plugin|youtube|lidarr|sillon|source/i);
      expect(texts).toMatch(lng === "fr" ? /bibliothèque personnelle/ : /personal library/);
    }
  });

  it("1.40.0 : le Liquid Glass n'existe qu'avec ses traits — ailleurs, et sans Octave, la release est vide et rien ne s'ouvre", () => {
    const release = WHATS_NEW_RELEASES.find((r) => r.version === "1.40.0");
    expect(release?.features.filter((f) => f.requires !== undefined).map((f) => [f.id, f.requires])).toEqual([
      ["glassNavigation", "liquidGlass"], ["glassPlayer", "liquidGlassPlayer"],
    ]);
    const noOctave = forServer(WHATS_NEW_RELEASES, new Set());
    const elsewhere = selectWhatsNewFeatures("1.40.0", "1.31.1", forClient(noOctave, new Set())).features;
    expect(elsewhere.map((f) => f.id)).not.toContain("glassNavigation");
    expect(elsewhere.map((f) => f.id)).not.toContain("glassPlayer");
    const intel = selectWhatsNewFeatures("1.40.0", "1.31.1", forClient(noOctave, new Set(["liquidGlass"] as const))).features;
    expect(intel.map((f) => f.id)).toEqual(["glassNavigation"]);
    const appleSilicon = selectWhatsNewFeatures(
      "1.40.0", "1.31.1", forClient(noOctave, new Set(["liquidGlass", "liquidGlassPlayer"] as const)),
    ).features;
    expect(appleSilicon.map((f) => f.id)).toEqual(["glassNavigation", "glassPlayer"]);
  });
});
