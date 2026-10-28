import { describe, expect, it } from "vitest";
import { createBackgroundDrain, DRAIN_IDLE_GIVE_UP_MS, type DrainDeps } from "./backgroundDrain";

function harness(start: { pending: number; busy: boolean }) {
  const state = { ...start, now: 0, quits: 0, relaunches: 0, stops: 0, announced: [] as number[], timers: 0 };
  const deps: DrainDeps = {
    pending: () => state.pending,
    busy: () => state.busy,
    quit: () => (state.quits += 1),
    relaunch: () => (state.relaunches += 1),
    stopPlayback: () => (state.stops += 1),
    announce: (n) => state.announced.push(n),
    now: () => state.now,
    every: () => {
      state.timers += 1;
      return { stop: () => (state.timers -= 1) };
    },
  };
  return { state, drain: createBackgroundDrain(deps) };
}

describe("fenêtre fermée, transferts qui continuent (bureau)", () => {
  it("la lecture s'arrête, l'application le dit, puis se ferme quand la file est vide", () => {
    const { state, drain } = harness({ pending: 12, busy: true });
    drain.begin();
    expect(drain.active()).toBe(true);
    expect(state.stops).toBe(1);
    expect(state.announced).toEqual([12]);
    drain.check();
    expect(state.quits).toBe(0);
    state.pending = 0;
    drain.check();
    expect(state.quits).toBe(1);
    expect(drain.active()).toBe(false);
    expect(state.timers).toBe(0);
  });

  it("plus rien ne bouge depuis dix minutes (réseau coupé) : elle se ferme, la file reprendra au lancement", () => {
    const { state, drain } = harness({ pending: 3, busy: false });
    drain.begin();
    drain.check();
    state.now = DRAIN_IDLE_GIVE_UP_MS - 1;
    drain.check();
    expect(state.quits).toBe(0);
    state.now = DRAIN_IDLE_GIVE_UP_MS;
    drain.check();
    expect(state.quits).toBe(1);
  });

  it("un transfert qui repart remet l'attente à zéro", () => {
    const { state, drain } = harness({ pending: 3, busy: false });
    drain.begin();
    drain.check();
    state.now = DRAIN_IDLE_GIVE_UP_MS - 1;
    state.busy = true;
    drain.check();
    state.busy = false;
    state.now = DRAIN_IDLE_GIVE_UP_MS + 1;
    drain.check();
    expect(state.quits).toBe(0);
  });

  it("rouvrir pendant la fin des transferts relance l'application, jamais une fenêtre dans le même processus", () => {
    const { state, drain } = harness({ pending: 3, busy: true });
    expect(drain.reopen()).toBe(false);
    drain.begin();
    expect(drain.reopen()).toBe(true);
    expect(state.relaunches).toBe(1);
    expect(drain.active()).toBe(false);
  });

  it("deux fermetures n'ouvrent pas deux attentes", () => {
    const { state, drain } = harness({ pending: 3, busy: true });
    drain.begin();
    drain.begin();
    expect(state.timers).toBe(1);
    expect(state.announced).toHaveLength(1);
  });
});
