import { describe, expect, it } from "vitest";
import {
  AUTO_NEXT_IDLE,
  NEXT_COUNTDOWN_MS,
  displayedNextCountdown,
  decideAutoNext,
  type AutoNextConfig,
  type AutoNextInput,
  type AutoNextState,
} from "./autoNextEngine";

const CONFIG: AutoNextConfig = {
  hasNextEpisode: true,
  serverEnabled: true,
  nextCountdown: true,
  nextAutoPlay: true,
};

const tick = (eligible = true, ended = false, elapsedMs = 1_000): AutoNextInput => ({
  type: "frame",
  eligible,
  ended,
  elapsedMs,
});

function run(
  inputs: AutoNextInput[],
  config: AutoNextConfig = CONFIG,
  initial: AutoNextState = { ...AUTO_NEXT_IDLE, forItemId: "ep-1" },
) {
  let state = initial;
  const effects: number[] = [];
  inputs.forEach((input, i) => {
    const [next, effect] = decideAutoNext(state, input, config);
    state = next;
    if (effect === "nextEpisode") effects.push(i);
  });
  return { state, effects };
}

const FULL_COUNTDOWN_TICKS = Array.from({ length: NEXT_COUNTDOWN_MS / 1000 }, () => tick());

describe("les combinaisons des réglages — chacun ne fait que sa part", () => {
  it("minuteur + enchaînement : l'épisode suivant part à zéro, une seule fois", () => {
    const { state, effects } = run([...FULL_COUNTDOWN_TICKS, tick(), tick()]);
    expect(effects).toEqual([NEXT_COUNTDOWN_MS / 1000 - 1]);
    expect(state.chained).toBe(true);
  });

  it("minuteur sans enchaînement : le décompte va au bout et rien ne part", () => {
    const config = { ...CONFIG, nextAutoPlay: false };
    const { state, effects } = run([...FULL_COUNTDOWN_TICKS, tick()], config);
    expect(effects).toEqual([]);
    expect(state.phase).toBe("card");
    expect(displayedNextCountdown(state)).toBeNull();
  });

  it("enchaînement sans minuteur : sans échéance, rien ne part jamais tout seul", () => {
    const config = { ...CONFIG, nextCountdown: false };
    const { state, effects } = run(Array.from({ length: 30 }, () => tick()), config);
    expect(effects).toEqual([]);
    expect(state).toMatchObject({ phase: "card", remainingMs: null });
  });

  it("ni minuteur ni enchaînement : une proposition, rien d'autre", () => {
    const config = { ...CONFIG, nextCountdown: false, nextAutoPlay: false };
    const { state, effects } = run([tick(), tick(), tick()], config);
    expect(effects).toEqual([]);
    expect(displayedNextCountdown(state)).toBeNull();
  });
});

describe("cycle de vie", () => {
  it("le minuteur s'affiche en secondes et descend", () => {
    const { state } = run([tick(), tick(), tick()]);
    expect(displayedNextCountdown(state)).toBe(NEXT_COUNTDOWN_MS / 1000 - 3);
  });

  it("sortir de la fenêtre remet le minuteur à zéro, y revenir le réarme entier", () => {
    const { state } = run([tick(), tick(), tick(), tick(false), tick()]);
    expect(state.remainingMs).toBe(NEXT_COUNTDOWN_MS - 1_000);
  });

  it("le refus vaut pour l'épisode : minuteur coupé, réarmé au changement d'item", () => {
    const dismissed = run([tick(), { type: "dismiss" }, tick(), tick()]);
    expect(dismissed.effects).toEqual([]);
    expect(dismissed.state).toMatchObject({ phase: "idle", dismissed: true, remainingMs: null });

    const next = run([{ type: "item", itemId: "ep-2" }, tick()], CONFIG, dismissed.state);
    expect(next.state).toMatchObject({ dismissed: false, forItemId: "ep-2", phase: "card" });
  });

  it("revoir le même item ne réarme pas un refus", () => {
    const { state } = run([
      { type: "dismiss" },
      { type: "item", itemId: "ep-1" },
      tick(),
    ]);
    expect(state.dismissed).toBe(true);
    expect(state.phase).toBe("idle");
  });

  it("l'escalade carte → écran de fin conserve le minuteur en cours", () => {
    const { state } = run([tick(), tick(), tick(), tick(true, true)]);
    expect(state.phase).toBe("final");
    expect(state.remainingMs).toBe(NEXT_COUNTDOWN_MS - 4_000);
  });

  it("une fin de lecture directe arme son propre minuteur", () => {
    const { state } = run([tick(false, true)]);
    expect(state).toMatchObject({ phase: "final", remainingMs: NEXT_COUNTDOWN_MS - 1_000 });
  });

  it("« lire maintenant » part tout de suite, et une seule fois", () => {
    const { effects } = run([
      tick(),
      { type: "playNow" },
      { type: "playNow" },
      ...FULL_COUNTDOWN_TICKS,
    ]);
    expect(effects).toEqual([1]);
  });

  it("la garde serveur ou l'absence d'épisode suivant éteint tout", () => {
    const withoutServer = run([...FULL_COUNTDOWN_TICKS], { ...CONFIG, serverEnabled: false });
    expect(withoutServer.effects).toEqual([]);
    expect(withoutServer.state.phase).toBe("idle");

    const withoutNext = run(
      [tick(), { type: "playNow" }],
      { ...CONFIG, hasNextEpisode: false },
    );
    expect(withoutNext.effects).toEqual([]);
  });
});

describe("le décompte tient dans le temps qui reste", () => {
  const config = {
    hasNextEpisode: true,
    serverEnabled: true,
    nextCountdown: true,
    nextAutoPlay: true,
    nextCountdownMs: 10_000,
  };

  it("garde la durée réglée quand le média a le temps devant lui", () => {
    const [state] = decideAutoNext(
      AUTO_NEXT_IDLE,
      { type: "frame", eligible: true, ended: false, elapsedMs: 0, remainingMediaMs: 120_000 },
      config,
    );
    expect(state.remainingMs).toBe(10_000);
    expect(state.armedMs).toBe(10_000);
  });

  it("le raccourcit quand la fiche paraît quatre secondes avant la fin", () => {
    // La demande, mot pour mot : fiche à 4 s de la fin, enchaînement à 3,5 s.
    const [state] = decideAutoNext(
      AUTO_NEXT_IDLE,
      { type: "frame", eligible: true, ended: false, elapsedMs: 0, remainingMediaMs: 4_000 },
      config,
    );
    expect(state.remainingMs).toBe(3_500);
    expect(state.armedMs).toBe(3_500);
  });

  it("enchaîne tout de suite quand il ne reste plus rien", () => {
    const [, effect] = decideAutoNext(
      AUTO_NEXT_IDLE,
      { type: "frame", eligible: true, ended: false, elapsedMs: 0, remainingMediaMs: 300 },
      config,
    );
    expect(effect).toBe("nextEpisode");
  });

  it("s'en tient au réglage quand la durée restante est inconnue", () => {
    const [state] = decideAutoNext(
      AUTO_NEXT_IDLE,
      { type: "frame", eligible: true, ended: false, elapsedMs: 0 },
      config,
    );
    expect(state.remainingMs).toBe(10_000);
  });

  it("honore une durée réglée courte", () => {
    const [state] = decideAutoNext(
      AUTO_NEXT_IDLE,
      { type: "frame", eligible: true, ended: false, elapsedMs: 0, remainingMediaMs: 120_000 },
      { ...config, nextCountdownMs: 2_500 },
    );
    expect(state.remainingMs).toBe(2_500);
  });

  it("ne réarme PAS en cours de route — la marge se calcule une fois", () => {
    let [state] = decideAutoNext(
      AUTO_NEXT_IDLE,
      { type: "frame", eligible: true, ended: false, elapsedMs: 0, remainingMediaMs: 120_000 },
      config,
    );
    [state] = decideAutoNext(
      state,
      { type: "frame", eligible: true, ended: false, elapsedMs: 1_000, remainingMediaMs: 4_000 },
      config,
    );
    expect(state.remainingMs).toBe(9_000);
    expect(state.armedMs).toBe(10_000);
  });
});
