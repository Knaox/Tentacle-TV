/**
 * L'arbitre de débit : parts équitables entre comptes, redistribution de ce
 * qu'un compte lent laisse, pools séparés, changement de plafond à chaud, et
 * jamais de fenêtre muette sous un plafond bas. Horloge et ticks à la main.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BandwidthArbiter, MAX_BLOCK, type FlowHandle } from "./arbiter";
import type { BandwidthCaps } from "./caps";

const MIB = 1024 * 1024;
/** Un tick de 100 ms sous 1 Mio/s. */
const TICK_BUDGET = Math.floor((MIB * 100) / 1000);

let clock: number;
let caps: BandwidthCaps;
let arbiter: BandwidthArbiter;

/** Puise tout ce que le flux accorde, bloc par bloc. */
function drain(handle: FlowHandle): number {
  let total = 0;
  for (let granted = handle.take(MAX_BLOCK); granted > 0; granted = handle.take(MAX_BLOCK)) {
    total += granted;
  }
  return total;
}

function tick(ms = 100): void {
  clock += ms;
  arbiter.tick();
}

beforeEach(() => {
  vi.useFakeTimers();
  clock = 1_000;
  caps = { internal: MIB, external: MIB };
  arbiter = new BandwidthArbiter(() => caps, { now: () => clock });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("BandwidthArbiter", () => {
  it("un compte affamé reçoit le budget du tick, après un premier bloc immédiat", () => {
    const flow = arbiter.register("a", "internal");
    expect(drain(flow)).toBe(MAX_BLOCK);
    tick();
    expect(drain(flow)).toBe(TICK_BUDGET);
  });

  it("deux comptes affamés se partagent le budget à un octet près", () => {
    const a = arbiter.register("a", "internal");
    const b = arbiter.register("b", "internal");
    drain(a);
    drain(b);
    tick();
    const [ga, gb] = [drain(a), drain(b)];
    expect(ga + gb).toBe(TICK_BUDGET);
    expect(Math.abs(ga - gb)).toBeLessThanOrEqual(1);
  });

  it("ce qu'un compte lent ne prend pas revient à l'affamé", () => {
    const slow = arbiter.register("a", "internal");
    const hungry = arbiter.register("b", "internal");
    expect(slow.take(10_240)).toBe(10_240);
    drain(hungry);
    for (let i = 0; i < 3; i++) {
      tick();
      expect(slow.take(10_240)).toBe(10_240);
      expect(drain(hungry)).toBeGreaterThanOrEqual(TICK_BUDGET - 12_800);
    }
  });

  it("un compte à deux transferts partage sa part, l'autre compte garde la sienne", () => {
    const a1 = arbiter.register("a", "internal");
    const a2 = arbiter.register("a", "internal");
    const b = arbiter.register("b", "internal");
    drain(a1);
    drain(a2);
    drain(b);
    tick();
    const [g1, g2, gb] = [drain(a1), drain(a2), drain(b)];
    expect(Math.abs(g1 - g2)).toBeLessThanOrEqual(1);
    expect(Math.abs(gb - (g1 + g2))).toBeLessThanOrEqual(2);
    expect(g1 + g2 + gb).toBe(TICK_BUDGET);
  });

  it("les pools sont séparés : l'un illimité, l'autre plafonné", async () => {
    caps = { internal: null, external: MIB };
    const inside = arbiter.register("a", "internal");
    const outside = arbiter.register("a", "external");
    expect(inside.take(5 * MIB)).toBe(5 * MIB);
    await expect(inside.next()).resolves.toBeUndefined();
    expect(drain(outside)).toBe(MAX_BLOCK);
    tick();
    expect(drain(outside)).toBe(TICK_BUDGET);
    expect(arbiter.snapshot()).toEqual({
      internal: { users: 1, flows: 1 },
      external: { users: 1, flows: 1 },
    });
  });

  it("sans plafond, rien n'attend — et le flux reste connu, pour un plafond posé plus tard", () => {
    caps = { internal: null, external: null };
    const flow = arbiter.register("a", "external");
    expect(flow.take(3 * MIB)).toBe(3 * MIB);
    expect(arbiter.snapshot().external.flows).toBe(1);
    caps = { internal: null, external: MIB };
    tick();
    expect(drain(flow)).toBeLessThanOrEqual(TICK_BUDGET);
    expect(drain(flow)).toBe(0);
  });

  it("un plafond levé à chaud réveille les flux qui attendaient", async () => {
    const flow = arbiter.register("a", "external");
    drain(flow);
    const pending = flow.next();
    caps = { internal: MIB, external: null };
    tick();
    await expect(pending).resolves.toBeUndefined();
    expect(flow.take(3 * MIB)).toBe(3 * MIB);
  });

  it("libérer un flux rend sa part, rejette son attente et désarme le minuteur", async () => {
    const a = arbiter.register("a", "internal");
    const b = arbiter.register("b", "internal");
    expect(vi.getTimerCount()).toBe(1);
    drain(a);
    const pending = a.next();
    a.release();
    a.release();
    await expect(pending).rejects.toThrow("flow released");
    expect(a.take(MAX_BLOCK)).toBe(0);
    expect(arbiter.snapshot().internal).toEqual({ users: 1, flows: 1 });
    drain(b);
    tick();
    expect(drain(b)).toBe(TICK_BUDGET);
    b.release();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("sous un plafond bas, chaque flux reçoit des octets à chaque tick", () => {
    caps = { internal: 64 * 1024, external: MIB };
    const flows = ["a", "b", "c"].map((user) => arbiter.register(user, "internal"));
    for (const flow of flows) drain(flow);
    tick();
    for (const flow of flows) expect(drain(flow)).toBeGreaterThan(0);
  });

  it("un processus qui a dormi ne libère pas une rafale : deux ticks au plus", () => {
    const flow = arbiter.register("a", "internal");
    drain(flow);
    tick(5_000);
    // Deux ticks de budget (l'arrondi d'un tick double, pas cinquante ticks).
    expect(drain(flow)).toBe(Math.floor((MIB * 200) / 1000));
  });
});
