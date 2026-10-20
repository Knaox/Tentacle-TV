import { describe, expect, it } from "vitest";
import { BOOT_INTRO_MAX_HOLD_MS, bootIntroOutcome } from "@tentacle-tv/shared/brandIntro";
import { MOBILE_BOOT_SELF_REPORTING, bootRouteOf, mobileBootPlan } from "./bootIntroRules";
import { DEFAULT_BOOT_INTRO_SETTINGS, readBootIntroSettings, settingOn } from "./bootIntroSettings";

const cold = { coldStart: true, reducedMotion: false, settings: DEFAULT_BOOT_INTRO_SETTINGS };

describe("quand jouer l'ouverture sur le mobile", () => {
  it("au démarrage à froid, avec son, par défaut", () => {
    expect(mobileBootPlan(cold)).toEqual({ plan: "intro", sound: true });
  });

  it("jamais hors du démarrage à froid (retour d'arrière-plan, rechargement, changement de profil)", () => {
    expect(mobileBootPlan({ ...cold, coldStart: false })).toEqual({ plan: "boot", sound: false });
  });

  it("jamais avec « Réduire les animations » du système, ni le réglage d'appareil coupé", () => {
    expect(mobileBootPlan({ ...cold, reducedMotion: true }).plan).toBe("boot");
    expect(mobileBootPlan({ ...cold, settings: { intro: false, sound: true } })).toEqual({ plan: "boot", sound: false });
  });

  it("« Son au démarrage » coupé : l'animation sans son", () => {
    expect(mobileBootPlan({ ...cold, settings: { intro: true, sound: false } })).toEqual({ plan: "intro", sound: false });
  });
});

describe("les réglages d'appareil", () => {
  it("seul « 0 » coupe ; absent, illisible ou en échec : allumé", async () => {
    expect(settingOn(null)).toBe(true);
    expect(settingOn("1")).toBe(true);
    expect(settingOn("0")).toBe(false);
    const disk = new Map([["tentacle_boot_sound", "0"]]);
    expect(await readBootIntroSettings(async (key) => disk.get(key) ?? null)).toEqual({ intro: true, sound: false });
    expect(await readBootIntroSettings(() => Promise.reject(new Error("disque")))).toEqual({ intro: true, sound: true });
  });
});

describe("quand partir : le premier écran du mobile", () => {
  const watch = (route: string | null, screen: "loading" | "ready" | "failed" | null = null, heldMs = 0) =>
    bootIntroOutcome({ route, screen, blocked: false, heldMs, selfReporting: MOBILE_BOOT_SELF_REPORTING });

  it("attend tant que l'app relit son stockage : aucune route", () => {
    expect(bootRouteOf("/", false)).toBeNull();
    expect(watch(bootRouteOf("/", false))).toBe("wait");
  });

  it("l'accueil et « Qui regarde ? » attendent d'être prêts, au plus 8 s", () => {
    expect(watch("/", "loading")).toBe("wait");
    expect(watch("/", "ready")).toBe("go");
    expect(watch("/who-is-watching")).toBe("wait");
    expect(watch("/who-is-watching", "failed")).toBe("go");
    expect(watch("/", "loading", BOOT_INTRO_MAX_HOLD_MS)).toBe("go");
  });

  it("la connexion, le choix du serveur, une fiche : dès qu'ils sont montés", () => {
    for (const route of ["/login", "/server-setup", "/media/abc"]) expect(watch(bootRouteOf(route, true)), route).toBe("go");
  });
});
