import { describe, expect, it } from "vitest";
import { INTRO_HOLD_AT, INTRO_TIMING, introCameraPlan, introGeometry, introTracks, poseAt } from "@tentacle-tv/shared/brandIntro";
import {
  BOOT_INTRO_MAX_HOLD_MS,
  BOOT_SOUND_FILE_AT,
  BOOT_SOUND_REQUEST_AT,
  bootIntroOutcome,
  bootSoundStartAt,
  decideBootIntro,
  loopValue,
  sampleIntro,
  sampleIntroHold,
  sampleValue,
} from "./index";

const ART = {
  SCREEN: { x: 58, y: 104, width: 124, height: 92, rx: 16, frameWidth: 5 },
  PLAY_PATH: "M 114 134 L 142 150 L 114 166 Z",
  FRONT_ARM_PATHS: ["M 81 92 L 60 150 L 93 190 Z", "M 159 92 L 180 150 L 147 190 Z"],
  BACK_ARM_PATHS: ["M 84 150 L 71 200 L 102 228 Z", "M 156 150 L 169 200 L 138 228 Z"],
  EYE_WHITES: [{ cx: 99, cy: 82, r: 15.5 }, { cx: 141, cy: 82, r: 15.5 }],
};
const geometry = introGeometry(ART);

describe("quand jouer l'ouverture", () => {
  const cold = { supported: true, reducedMotion: false, initialRoute: "Home", interruptedPlayback: false };

  it("au démarrage à froid qui mène à l'accueil", () => {
    expect(decideBootIntro(cold)).toBe("intro");
  });

  // Régression du 2026-10-18 (« Chambre », build Release) : une TV passée aux profils
  // démarre sur « Qui regarde ? » à chaque lancement — l'ouverture ne s'y jouait jamais.
  it("d'elle-même aussi sur « Qui regarde ? » (TV à profils) et sur une fenêtre du démarrage", () => {
    for (const initialRoute of ["Profiles", "PinSetup", "RailSetup", "PhotoSetup"]) {
      expect(decideBootIntro({ ...cold, initialRoute })).toBe("intro");
    }
  });

  it("jamais sur une plateforme qui ne l'a pas, avec le mouvement réduit, au jumelage, ni pour une relance", () => {
    expect(decideBootIntro({ ...cold, supported: false })).toBe("boot");
    expect(decideBootIntro({ ...cold, reducedMotion: true })).toBe("boot");
    expect(decideBootIntro({ ...cold, reducedMotion: true, initialRoute: "Profiles" })).toBe("boot");
    expect(decideBootIntro({ ...cold, initialRoute: "PairCode" })).toBe("boot");
    expect(decideBootIntro({ ...cold, interruptedPlayback: true })).toBe("boot");
  });
});

describe("attendre, partir, renoncer", () => {
  const watch = { route: "Home", screen: null, blocked: false, heldMs: 0 } as const;

  it("attend que la navigation et le premier écran soient prêts, part dès qu'il l'est, ou au bout de l'attente", () => {
    expect(bootIntroOutcome({ ...watch, route: null })).toBe("wait");
    expect(bootIntroOutcome(watch)).toBe("wait");
    expect(bootIntroOutcome({ ...watch, screen: "loading" })).toBe("wait");
    expect(bootIntroOutcome({ ...watch, screen: "ready" })).toBe("go");
    expect(bootIntroOutcome({ ...watch, heldMs: BOOT_INTRO_MAX_HOLD_MS })).toBe("go");
  });

  it("« Qui regarde ? » attend sa rangée ; une fenêtre du démarrage part dès qu'elle est montée", () => {
    expect(bootIntroOutcome({ ...watch, route: "Profiles", screen: "loading" })).toBe("wait");
    expect(bootIntroOutcome({ ...watch, route: "Profiles", screen: "ready" })).toBe("go");
    expect(bootIntroOutcome({ ...watch, route: "RailSetup" })).toBe("go");
  });

  it("renonce devant le hors ligne, une migration, un accès suspendu, un écran en échec ou le jumelage", () => {
    expect(bootIntroOutcome({ ...watch, screen: "ready", blocked: true })).toBe("abort");
    expect(bootIntroOutcome({ ...watch, screen: "failed" })).toBe("abort");
    expect(bootIntroOutcome({ ...watch, route: "Profiles", screen: "failed" })).toBe("abort");
    expect(bootIntroOutcome({ ...watch, route: "PairCode" })).toBe("abort");
  });
});

describe("les tableaux de l'image", () => {
  const plan = introCameraPlan(1920, 1080, geometry);
  const samples = sampleIntro(geometry, plan);

  it("couvrent toute la chorégraphie et rejoignent le pur", () => {
    expect((samples.count - 1) * samples.step).toBeGreaterThanOrEqual(INTRO_TIMING.end);
    const hat = introTracks(geometry).hat;
    for (const t of [0, 500, 777, 1100]) {
      const y = sampleValue(samples.parts.hat.values.y ?? [], samples.step, t);
      expect(y).toBeCloseTo(poseAt(hat, t).transform.y, 0);
    }
  });

  it("arrivent sur l'écran à l'échelle 1 : caméra posée, vitre ouverte, bras effacés", () => {
    const end = INTRO_TIMING.end;
    expect(sampleValue(samples.camera.zoom, samples.step, end)).toBeCloseTo(plan.to.zoom, 6);
    expect(sampleValue(samples.camera.offsetY, samples.step, end)).toBeCloseTo(0, 6);
    expect(sampleValue(samples.reveal, samples.step, end)).toBe(1);
    expect(sampleValue(samples.armsAway.opacity, samples.step, end)).toBe(0);
  });

  it("une boucle de l'attente se répète, sa base avant son délai", () => {
    const hold = sampleIntroHold(geometry);
    const sparkle = hold.sparkles[0];
    if (!sparkle) throw new Error("étincelle");
    expect(loopValue(sparkle, sparkle.opacity, 0, sparkle.baseOpacity)).toBe(0);
    const at = sparkle.delay + 300;
    expect(loopValue(sparkle, sparkle.opacity, at + sparkle.period, 0)).toBeCloseTo(loopValue(sparkle, sparkle.opacity, at, 0), 6);
  });
});

describe("le son calé à l'image", () => {
  it("le fichier part un peu avant l'appui, demandé avant l'attente", () => {
    expect(BOOT_SOUND_FILE_AT).toBe(INTRO_TIMING.press.at - 40);
    expect(BOOT_SOUND_REQUEST_AT).toBeLessThanOrEqual(INTRO_HOLD_AT);
    expect(bootSoundStartAt(10_000, BOOT_SOUND_REQUEST_AT)).toBe(10_000 + BOOT_SOUND_FILE_AT - BOOT_SOUND_REQUEST_AT);
  });
});

describe("les plaques nettes de la plongée", () => {
  it("prennent le relais une fois, pendant la plongée, et gardent l'arrivée", async () => {
    const { plateSwapAt, INTRO_PLATES } = await import("./index");
    const plan = introCameraPlan(1920, 1080, geometry);
    const samples = sampleIntro(geometry, plan);
    const swapAt = plateSwapAt(samples, plan.from.zoom);
    expect(swapAt).toBeGreaterThan(INTRO_TIMING.zoom.at);
    expect(swapAt).toBeLessThan(INTRO_TIMING.end);
    const zoomAt = sampleValue(samples.camera.zoom, samples.step, swapAt);
    expect(zoomAt / plan.from.zoom).toBeGreaterThanOrEqual(Math.sqrt(INTRO_PLATES.early * INTRO_PLATES.late) - 1e-9);
  });
});
