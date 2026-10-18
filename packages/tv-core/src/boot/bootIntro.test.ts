import { describe, expect, it } from "vitest";
import { INTRO_HOLD_AT, INTRO_TIMING, introCameraPlan, introGeometry, introTracks, poseAt } from "@tentacle-tv/shared/brandIntro";
import {
  BOOT_INTRO_MAX_HOLD_MS,
  BOOT_SOUND_FILE_AT,
  BOOT_SOUND_REQUEST_AT,
  FRESH_PROCESS,
  bootIntroOutcome,
  bootIntroTurn,
  type BootIntroTrigger,
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
  const cold = { supported: true, reducedMotion: false, coldStart: true };

  // Règle de Damien (2026-10-18, après « Chambre » : sa TV à profils ne la voyait jamais) :
  // à chaque démarrage à froid, quel que soit le premier écran — la décision ne regarde plus la route.
  it("à chaque démarrage à froid, d'elle-même", () => {
    expect(decideBootIntro(cold)).toBe("intro");
  });

  it("jamais hors d'un démarrage à froid, sur une plateforme qui ne l'a pas, ni avec le mouvement réduit", () => {
    expect(decideBootIntro({ ...cold, coldStart: false })).toBe("boot");
    expect(decideBootIntro({ ...cold, supported: false })).toBe("boot");
    expect(decideBootIntro({ ...cold, reducedMotion: true })).toBe("boot");
  });
});

describe("une seule fois par processus", () => {
  it("le premier montage est le démarrage à froid, et réclame l'ouverture", () => {
    const first = bootIntroTurn(FRESH_PROCESS, "mount");
    expect(first.coldStart).toBe(true);
    expect(first.memory.claimed).toBe(true);
  });

  it("jamais deux fois : rechargement de l'arbre, retour d'arrière-plan, profil choisi ou changé, jumelage, code PIN", () => {
    const after = bootIntroTurn(FRESH_PROCESS, "mount").memory;
    const triggers: BootIntroTrigger[] = ["mount", "foreground", "profileChosen", "profileSwitched", "paired", "pinEntered"];
    for (const trigger of triggers) {
      const turn = bootIntroTurn(after, trigger);
      expect(turn.coldStart, trigger).toBe(false);
      expect(decideBootIntro({ supported: true, reducedMotion: false, coldStart: turn.coldStart }), trigger).toBe("boot");
    }
  });

  it("rien d'autre qu'un montage ne démarre l'ouverture, même dans un processus neuf", () => {
    for (const trigger of ["foreground", "profileChosen", "profileSwitched", "paired", "pinEntered"] as const) {
      expect(bootIntroTurn(FRESH_PROCESS, trigger).coldStart, trigger).toBe(false);
    }
  });

  it("un démarrage sous mouvement réduit la réclame quand même : la couper ensuite ne la rejoue pas", () => {
    const first = bootIntroTurn(FRESH_PROCESS, "mount");
    expect(decideBootIntro({ supported: true, reducedMotion: true, coldStart: first.coldStart })).toBe("boot");
    expect(bootIntroTurn(first.memory, "mount").coldStart).toBe(false);
  });
});

describe("attendre, partir — jamais renoncer", () => {
  const watch = { route: "Home", screen: null, blocked: false, heldMs: 0 } as const;

  it("attend que l'app soit montée et que le premier écran soit prêt, ou le bout de l'attente", () => {
    expect(bootIntroOutcome({ ...watch, route: null })).toBe("wait");
    expect(bootIntroOutcome({ ...watch, route: null, blocked: true })).toBe("wait");
    expect(bootIntroOutcome(watch)).toBe("wait");
    expect(bootIntroOutcome({ ...watch, screen: "loading" })).toBe("wait");
    expect(bootIntroOutcome({ ...watch, screen: "ready" })).toBe("go");
    expect(bootIntroOutcome({ ...watch, heldMs: BOOT_INTRO_MAX_HOLD_MS })).toBe("go");
  });

  it("plonge dans tout premier écran : « Qui regarde ? » prêt, jumelage, barre, code PIN, photo dès qu'ils sont montés", () => {
    expect(bootIntroOutcome({ ...watch, route: "Profiles", screen: "loading" })).toBe("wait");
    expect(bootIntroOutcome({ ...watch, route: "Profiles", screen: "ready" })).toBe("go");
    for (const route of ["PairCode", "RailSetup", "PinSetup", "PhotoSetup", "MediaDetail"]) {
      expect(bootIntroOutcome({ ...watch, route }), route).toBe("go");
    }
  });

  it("plonge aussi dans un écran en échec, hors ligne, en migration ou « accès suspendu » : il dit lui-même ce qu'il en est", () => {
    expect(bootIntroOutcome({ ...watch, screen: "failed" })).toBe("go");
    expect(bootIntroOutcome({ ...watch, screen: "loading", blocked: true })).toBe("go");
    expect(bootIntroOutcome({ ...watch, route: "Profiles", screen: "failed" })).toBe("go");
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
