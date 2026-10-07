import { describe, expect, it } from "vitest";
import { LITE_PROFILE, renderProfileFor } from "./liteProfile";
import { BRIEF_MAX_MS, BRIEF_MOTION, briefDuration, briefLegMs } from "./liteMotion";
import { RENDER_PROFILES } from "./renderProfile";
import { heroRotateDelay, HERO_ROTATE_MS } from "../hero/rotation";

describe("le profil Lite", () => {
  it("n'existe que sur Android TV : l'Apple TV garde son profil, quel que soit le niveau", () => {
    expect(renderProfileFor("tvos", "lite")).toBe(RENDER_PROFILES.tvos);
    expect(renderProfileFor("tvos", "normal")).toBe(RENDER_PROFILES.tvos);
    expect(renderProfileFor("androidtv", "normal")).toBe(RENDER_PROFILES.androidtv);
    expect(renderProfileFor("androidtv", "lite")).toBe(LITE_PROFILE);
  });

  it("garde intacts les deux profils de référence (aucun effet Lite en mode normal)", () => {
    for (const profile of [RENDER_PROFILES.tvos, RENDER_PROFILES.androidtv]) {
      expect(profile).toMatchObject({
        motionStyle: "full",
        cardFocus: "lift",
        ambient: "lights",
        ambientFollow: "focus",
        glass: "layered",
        gradients: "smooth",
        pageTransition: "fade",
        heroDelayFactor: 1,
        heroTextSwap: true,
      });
    }
  });

  it("remplace chaque effet coûteux par son équivalent sobre, et ne change que les effets", () => {
    const android = RENDER_PROFILES.androidtv;
    expect(LITE_PROFILE).toEqual({
      ...android,
      motionStyle: "brief",
      cardFocus: "outline",
      ambient: "tint",
      ambientFollow: "screen",
      shadows: "border",
      glass: "flat",
      gradients: "twoStop",
      pageTransition: "cut",
      heroDelayFactor: 1.5,
      heroTextSwap: false,
    });
    // Les flous ne coûtent rien : gardés ; images, montage et culling : ceux d'Android TV.
    expect(LITE_PROFILE.halos).toBe(android.halos);
    expect(LITE_PROFILE.cardArtwork).toBe(android.cardArtwork);
    expect(LITE_PROFILE.motion).toBe(true);
  });

  it("espace la rotation du héros en Lite (12 s), et la garde à 8 s ailleurs", () => {
    expect(heroRotateDelay(false, LITE_PROFILE.heroDelayFactor)).toBe(12_000);
    expect(heroRotateDelay(false)).toBe(HERO_ROTATE_MS);
    expect(heroRotateDelay(true)).toBe(HERO_ROTATE_MS * 2);
  });
});

describe("le mouvement bref", () => {
  it("ne dépasse jamais 150 ms, ni à l'aller ni au retour", () => {
    for (const [name, leg] of Object.entries(BRIEF_MOTION)) {
      expect(leg.enterMs, name).toBeLessThanOrEqual(BRIEF_MAX_MS);
      expect(leg.exitMs, name).toBeLessThanOrEqual(BRIEF_MAX_MS);
    }
    expect(briefLegMs("inconnu", 1)).toBeLessThanOrEqual(BRIEF_MAX_MS);
    expect(briefDuration(600)).toBe(BRIEF_MAX_MS);
    expect(briefDuration(80)).toBe(80);
  });

  it("pose d'un coup ce qui ne fait qu'accompagner : image qui se pose, recul, halo du héros", () => {
    for (const name of ["settle", "recede", "heroHalo", "imageIn"]) {
      expect(briefLegMs(name, 1), name).toBe(0);
      expect(briefLegMs(name, 0), name).toBe(0);
    }
  });

  it("garde un fondu court là où un changement doit se voir : focus, fond, image du héros", () => {
    expect(briefLegMs("focus", 1)).toBeGreaterThan(0);
    expect(briefLegMs("ambient", 1)).toBeGreaterThan(0);
    expect(briefLegMs("hero", 1)).toBeGreaterThan(0);
    // Le retour est plus bref que l'aller (ou égal).
    for (const leg of Object.values(BRIEF_MOTION)) expect(leg.exitMs).toBeLessThanOrEqual(Math.max(leg.enterMs, 140));
  });
});
