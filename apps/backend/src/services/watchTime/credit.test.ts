import { describe, it, expect } from "vitest";
import { credit, TICK_MS, CREDIT_MAX_MS } from "./credit";
import type { Sample, SessionState } from "./types";

/**
 * Toute la justesse de la mesure se joue ici. `credit` étant pure, chaque
 * scénario est une suite d'échantillons et d'horloges — y compris des cas qu'on
 * ne sait pas provoquer à la main : horloge qui recule, trou de cinq minutes,
 * client fantôme.
 */

const TICKS_PER_SECOND = 10_000_000;

function sample(over: Partial<Sample> = {}): Sample {
  return {
    sessionKey: "s1",
    userId: "u1",
    itemId: "film1",
    itemType: "Movie",
    itemName: "Un film",
    seriesId: null,
    seriesName: null,
    clientName: "Web",
    deviceName: "Chrome",
    runtimeSeconds: 7200,
    paused: false,
    active: true,
    positionTicks: 0,
    checkInMs: null,
    ...over,
  };
}

/** Déroule une suite de relevés et rend les secondes accumulées par session. */
function run(
  frames: { advanceMs: number; samples: Sample[] }[],
): { state: Map<string, SessionState>; seconds: (k: string) => number } {
  let state = new Map<string, SessionState>();
  let mono = 1_000_000;
  let clock = Date.parse("2026-08-05T20:00:00Z");
  for (const frame of frames) {
    mono += frame.advanceMs;
    clock += frame.advanceMs;
    state = credit(state, frame.samples, mono, clock).state;
  }
  return {
    state,
    seconds: (k) => Math.round(state.get(k)?.seconds ?? 0),
  };
}

/** Position qui avance normalement, en ticks. */
const pos = (seconds: number) => seconds * TICKS_PER_SECOND;

describe("credit", () => {
  it("ne crédite rien au tout premier relevé", () => {
    const { seconds } = run([{ advanceMs: 0, samples: [sample()] }]);
    expect(seconds("s1::film1")).toBe(0);
  });

  it("crédite le temps écoulé sur une lecture normale", () => {
    const frames = Array.from({ length: 11 }, (_, i) => ({
      advanceMs: i === 0 ? 0 : TICK_MS,
      samples: [sample({ positionTicks: pos(i * 15) })],
    }));
    // 11 relevés → 10 intervalles de 15 s.
    expect(run(frames).seconds("s1::film1")).toBe(150);
  });

  it("ne compte pas le temps en pause", () => {
    const { seconds } = run([
      { advanceMs: 0, samples: [sample({ positionTicks: pos(0) })] },
      { advanceMs: TICK_MS, samples: [sample({ positionTicks: pos(15) })] },
      { advanceMs: TICK_MS, samples: [sample({ positionTicks: pos(15), paused: true })] },
      { advanceMs: TICK_MS, samples: [sample({ positionTicks: pos(15), paused: true })] },
      { advanceMs: TICK_MS, samples: [sample({ positionTicks: pos(15) })] },
      { advanceMs: TICK_MS, samples: [sample({ positionTicks: pos(30) })] },
    ]);
    // Seuls le 1er et le dernier intervalle sont en lecture des deux côtés.
    expect(seconds("s1::film1")).toBe(30);
  });

  it("écrête un trou de cinq minutes au maximum autorisé", () => {
    const { seconds } = run([
      { advanceMs: 0, samples: [sample({ positionTicks: pos(0) })] },
      { advanceMs: 300_000, samples: [sample({ positionTicks: pos(300) })] },
    ]);
    expect(seconds("s1::film1")).toBe(CREDIT_MAX_MS / 1000);
  });

  it("cesse de créditer une lecture dont la position est figée", () => {
    // Le client est mort mais Jellyfin croit encore qu'il joue : ni pause, ni
    // inactivité — seule la position immobile trahit le fantôme.
    const frames = [{ advanceMs: 0, samples: [sample({ positionTicks: pos(0) })] }];
    for (let i = 0; i < 20; i++) frames.push({ advanceMs: TICK_MS, samples: [sample({ positionTicks: pos(0) })] });
    // 120 s de tolérance, soit 8 intervalles de 15 s, puis plus rien.
    expect(run(frames).seconds("s1::film1")).toBe(120);
  });

  it("ne crédite pas quand le signe de vie du client est périmé", () => {
    const clockStart = Date.parse("2026-08-05T20:00:00Z");
    let state = new Map<string, SessionState>();
    state = credit(state, [sample({ positionTicks: pos(0) })], 1000, clockStart).state;
    const tally = credit(
      state,
      [sample({ positionTicks: pos(15), checkInMs: clockStart - 200_000 })],
      1000 + TICK_MS,
      clockStart + TICK_MS,
    );
    expect(Math.round(tally.state.get("s1::film1")!.seconds)).toBe(0);
  });

  it("crédite quand le signe de vie est inconnu — inconnu n'est pas périmé", () => {
    const { seconds } = run([
      { advanceMs: 0, samples: [sample({ positionTicks: pos(0), checkInMs: null })] },
      { advanceMs: TICK_MS, samples: [sample({ positionTicks: pos(15), checkInMs: null })] },
    ]);
    expect(seconds("s1::film1")).toBe(15);
  });

  it("repart de zéro quand la session change de titre", () => {
    const { seconds, state } = run([
      { advanceMs: 0, samples: [sample({ positionTicks: pos(0) })] },
      { advanceMs: TICK_MS, samples: [sample({ positionTicks: pos(15) })] },
      { advanceMs: TICK_MS, samples: [sample({ itemId: "film2", positionTicks: pos(0) })] },
      { advanceMs: TICK_MS, samples: [sample({ itemId: "film2", positionTicks: pos(15) })] },
    ]);
    expect(seconds("s1::film2")).toBe(15);
    expect(state.has("s1::film1")).toBe(false);
  });

  it("crédite l'intervalle de clôture quand la session disparaît", () => {
    let state = new Map<string, SessionState>();
    let mono = 1000;
    const h = Date.parse("2026-08-05T20:00:00Z");
    state = credit(state, [sample({ positionTicks: pos(0) })], mono, h).state;
    mono += TICK_MS;
    state = credit(state, [sample({ positionTicks: pos(15) })], mono, h + TICK_MS).state;
    mono += 10_000;
    const tally = credit(state, [], mono, h + TICK_MS + 10_000);
    expect(tally.toClose).toHaveLength(1);
    // 15 s mesurées, plus les 10 s écoulées jusqu'à l'arrêt.
    expect(Math.round(tally.toClose[0].seconds)).toBe(25);
  });

  it("ne crédite pas la clôture d'une session déjà en pause", () => {
    let state = new Map<string, SessionState>();
    const h = Date.parse("2026-08-05T20:00:00Z");
    state = credit(state, [sample({ positionTicks: pos(0), paused: true })], 1000, h).state;
    const tally = credit(state, [], 1000 + TICK_MS, h + TICK_MS);
    expect(Math.round(tally.toClose[0].seconds)).toBe(0);
  });

  it("plafonne un compte qui joue sur deux appareils à la fois", () => {
    // Deux sessions du même utilisateur, chacune en lecture : le temps réel
    // écoulé reste 15 s, pas 30.
    const two = (p: number) => [
      sample({ sessionKey: "s1", positionTicks: pos(p) }),
      sample({ sessionKey: "s2", itemId: "film2", positionTicks: pos(p) }),
    ];
    const { state } = run([
      { advanceMs: 0, samples: two(0) },
      { advanceMs: TICK_MS, samples: two(15) },
    ]);
    const total = (state.get("s1::film1")?.seconds ?? 0) + (state.get("s2::film2")?.seconds ?? 0);
    expect(Math.round(total)).toBe(15);
  });

  it("ne plafonne pas deux comptes distincts qui regardent en même temps", () => {
    const two = (p: number) => [
      sample({ sessionKey: "s1", userId: "u1", positionTicks: pos(p) }),
      sample({ sessionKey: "s2", userId: "u2", itemId: "film2", positionTicks: pos(p) }),
    ];
    const { state } = run([
      { advanceMs: 0, samples: two(0) },
      { advanceMs: TICK_MS, samples: two(15) },
    ]);
    expect(Math.round(state.get("s1::film1")!.seconds)).toBe(15);
    expect(Math.round(state.get("s2::film2")!.seconds)).toBe(15);
  });

  it("ne crédite rien si l'horloge monotone recule", () => {
    let state = new Map<string, SessionState>();
    const h = Date.parse("2026-08-05T20:00:00Z");
    state = credit(state, [sample({ positionTicks: pos(0) })], 500_000, h).state;
    state = credit(state, [sample({ positionTicks: pos(15) })], 400_000, h + TICK_MS).state;
    expect(Math.round(state.get("s1::film1")!.seconds)).toBe(0);
  });

  it("continue de créditer malgré une avance rapide ou un retour arrière", () => {
    const { seconds } = run([
      { advanceMs: 0, samples: [sample({ positionTicks: pos(0) })] },
      { advanceMs: TICK_MS, samples: [sample({ positionTicks: pos(600) })] }, // saut avant
      { advanceMs: TICK_MS, samples: [sample({ positionTicks: pos(120) })] }, // saut arrière
    ]);
    // Le temps réellement passé devant l'écran reste 30 s : la position sert de
    // preuve de vie, jamais de mesure.
    expect(seconds("s1::film1")).toBe(30);
  });

  it("ignore une session marquée inactive", () => {
    const { seconds } = run([
      { advanceMs: 0, samples: [sample({ positionTicks: pos(0) })] },
      { advanceMs: TICK_MS, samples: [sample({ positionTicks: pos(15), active: false })] },
    ]);
    expect(seconds("s1::film1")).toBe(0);
  });
});
