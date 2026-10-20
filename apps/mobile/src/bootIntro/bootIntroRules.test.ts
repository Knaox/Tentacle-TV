import { describe, expect, it } from "vitest";
import { BOOT_INTRO_MAX_HOLD_MS, bootIntroOutcome } from "@tentacle-tv/shared/brandIntro";
import {
  MOBILE_BOOT_SELF_REPORTING,
  mobileBootArrival,
  mobileBootPlan,
  overlayBootRoute,
  overlayScreenState,
  type BootFirstScreenOverlay,
  type MobileArrivalInput,
} from "./bootIntroRules";
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

const base: MobileArrivalInput = { appReady: true, pathname: "/", redirecting: false, offline: false, overlays: {}, shown: new Set() };
const shown = (...overlays: BootFirstScreenOverlay[]) => new Set(overlays);

describe("la route d'arrivée : le premier écran RÉEL, décidé avant la plongée", () => {
  it("rien tant que l'app relit son stockage, ou qu'une garde va remplacer la route", () => {
    expect(mobileBootArrival({ ...base, appReady: false }).route).toBeNull();
    expect(mobileBootArrival({ ...base, pathname: null }).route).toBeNull();
    // Première ouverture : l'accueil monté par défaut va céder la place au choix du serveur.
    expect(mobileBootArrival({ ...base, redirecting: true }).route).toBeNull();
  });

  it("la connexion, le choix du serveur, une fiche restaurée : leur chemin", () => {
    for (const pathname of ["/login", "/server-setup", "/media/abc", "/profile"]) {
      expect(mobileBootArrival({ ...base, pathname })).toEqual({ route: pathname, pending: false, blocked: false });
    }
  });

  it("« Qui regarde ? » pas encore tranché : on attend, l'accueil n'est pas le premier écran", () => {
    expect(mobileBootArrival({ ...base, overlays: { profiles: "pending" } })).toEqual({ route: "/", pending: true, blocked: false });
  });

  it("décidé mais pas encore à l'écran (le premier lancement attend son calme) : on attend encore", () => {
    expect(mobileBootArrival({ ...base, overlays: { firstRun: "active" } }).pending).toBe(true);
  });

  it("à l'écran : la plongée se fait DANS lui", () => {
    const arrival = mobileBootArrival({ ...base, overlays: { profiles: "active" }, shown: shown("profiles") });
    expect(arrival).toEqual({ route: overlayBootRoute("profiles"), pending: false, blocked: false });
    expect(mobileBootArrival({ ...base, overlays: { firstRun: "active" }, shown: shown("firstRun") }).route).toBe("overlay:firstRun");
  });

  it("« Qui regarde ? » l'emporte sur le premier lancement qui attend derrière lui", () => {
    const arrival = mobileBootArrival({ ...base, overlays: { profiles: "active", firstRun: "pending" }, shown: shown("profiles") });
    expect(arrival.route).toBe("overlay:profiles");
    expect(arrival.pending).toBe(false);
  });

  it("migration et accès suspendu recouvrent tout : la plongée aussitôt, dans eux", () => {
    for (const overlay of ["migration", "access"] as const) {
      const arrival = mobileBootArrival({ ...base, overlays: { [overlay]: "active", profiles: "pending" }, shown: shown(overlay, "profiles") });
      expect(arrival).toEqual({ route: overlayBootRoute(overlay), pending: false, blocked: true });
    }
  });

  it("hors ligne : le catalogue de l'appareil, aussitôt (une garde qui renvoie l'y attend d'abord)", () => {
    expect(mobileBootArrival({ ...base, offline: true, overlays: { profiles: "pending" } })).toEqual({ route: "/", pending: false, blocked: true });
    expect(mobileBootArrival({ ...base, offline: true, redirecting: true }).route).toBeNull();
  });
});

describe("quand partir : le premier écran du mobile", () => {
  const watch = (arrival: ReturnType<typeof mobileBootArrival>, screen: "loading" | "ready" | "failed" | null = null, heldMs = 0) =>
    bootIntroOutcome({ ...arrival, screen, heldMs, selfReporting: MOBILE_BOOT_SELF_REPORTING });

  it("attend tant que l'app relit son stockage : aucune route", () => {
    expect(watch(mobileBootArrival({ ...base, appReady: false }))).toBe("wait");
  });

  it("l'accueil attend d'être prêt (montré d'un bloc), au plus 8 s ; en échec, aussitôt", () => {
    const home = mobileBootArrival(base);
    expect(watch(home, "loading")).toBe("wait");
    expect(watch(home)).toBe("wait");
    expect(watch(home, "ready")).toBe("go");
    expect(watch(home, "failed")).toBe("go");
    expect(watch(home, "loading", BOOT_INTRO_MAX_HOLD_MS)).toBe("go");
  });

  it("un accueil prêt sous un « Qui regarde ? » qui n'a pas tranché : on attend, au plus 8 s", () => {
    const pending = mobileBootArrival({ ...base, overlays: { profiles: "pending" } });
    expect(watch(pending, "ready")).toBe("wait");
    expect(watch(pending, "ready", BOOT_INTRO_MAX_HOLD_MS)).toBe("go");
  });

  it("la connexion, le choix du serveur, une fiche : dès qu'ils sont montés", () => {
    for (const pathname of ["/login", "/server-setup", "/media/abc"]) expect(watch(mobileBootArrival({ ...base, pathname })), pathname).toBe("go");
  });

  it("« Qui regarde ? » à l'écran attend que l'accueil qu'il cache soit posé : son montage ne tombe jamais en pleine plongée", () => {
    const picker = mobileBootArrival({ ...base, overlays: { profiles: "active" }, shown: shown("profiles") });
    expect(overlayScreenState("/", {})).toBeNull();
    expect(watch(picker, overlayScreenState("/", {}))).toBe("wait");
    expect(watch(picker, overlayScreenState("/", { "/": "loading" }))).toBe("wait");
    expect(watch(picker, overlayScreenState("/", { "/": "ready" }))).toBe("go");
    expect(watch(picker, overlayScreenState("/", { "/": "failed" }))).toBe("go");
    expect(watch(picker, overlayScreenState("/", { "/": "loading" }), BOOT_INTRO_MAX_HOLD_MS)).toBe("go");
    // Sur un écran qui ne dit rien de lui-même : aussitôt.
    expect(watch(picker, overlayScreenState("/media/abc", {}))).toBe("go");
  });
});
