import { describe, expect, it } from "vitest";
import { PROBE_EVERY_MS, STALL_GRACE_MS } from "./playbackRecovery";
import { decideProducerDeath, SAME_PLACE_S, shouldCheckProducer } from "./producerDeath";

const T = 1_000_000;

describe("shouldCheckProducer", () => {
  const stalled = { prismCore: true, now: T, stalledSince: T - STALL_GRACE_MS, lastCheckAt: null, restarting: false };

  it("un arrêt sur le flux local, passé la grâce : on lit", () => {
    expect(shouldCheckProducer(stalled)).toBe(true);
  });

  it("pas sur un flux serveur, ni sans arrêt, ni avant la grâce, ni pendant une relance", () => {
    expect(shouldCheckProducer({ ...stalled, prismCore: false })).toBe(false);
    expect(shouldCheckProducer({ ...stalled, stalledSince: null })).toBe(false);
    expect(shouldCheckProducer({ ...stalled, stalledSince: T - STALL_GRACE_MS + 1 })).toBe(false);
    expect(shouldCheckProducer({ ...stalled, restarting: true })).toBe(false);
  });

  it("une lecture par période de sonde", () => {
    expect(shouldCheckProducer({ ...stalled, lastCheckAt: T - PROBE_EVERY_MS + 1 })).toBe(false);
    expect(shouldCheckProducer({ ...stalled, lastCheckAt: T - PROBE_EVERY_MS })).toBe(true);
  });
});

describe("decideProducerDeath", () => {
  const dead = { known: true, failed: true };

  it("rien à conclure : pont absent (hors tvOS), session inconnue, producteur vivant", () => {
    expect(decideProducerDeath({ status: null, position: 600, previous: null })).toBe("none");
    expect(decideProducerDeath({ status: { known: false, failed: false }, position: 600, previous: null })).toBe("none");
    expect(decideProducerDeath({ status: { known: true, failed: false }, position: 600, previous: null })).toBe("none");
  });

  it("une première mort : une relance neuve", () => {
    expect(decideProducerDeath({ status: dead, position: 600, previous: null })).toBe("restart");
  });

  it("remort au même endroit : le chemin serveur", () => {
    expect(decideProducerDeath({ status: dead, position: 604, previous: { gen: 1, at: 600 } })).toBe("serverPath");
    expect(decideProducerDeath({ status: dead, position: 600 + SAME_PLACE_S, previous: { gen: 1, at: 600 } })).toBe("serverPath");
  });

  it("une mort ailleurs, bien plus loin : une relance neuve de plus", () => {
    expect(decideProducerDeath({ status: dead, position: 600 + SAME_PLACE_S + 1, previous: { gen: 1, at: 600 } })).toBe("restart");
  });
});
