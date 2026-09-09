/**
 * La cause d'un passage hors ligne : posée dès le premier échec, effacée au
 * succès, « network » tant que l'appareil n'a pas de lien, « timeout » quand
 * le serveur n'a pas répondu à temps — et un changement de cause seule suffit
 * à reconstruire l'instantané.
 */

import { describe, expect, it } from "vitest";
import { deriveLinkQuality, type HysteresisConfig, type HysteresisState } from "./connectivityMachine";
import {
  applyProbe,
  initialConnectivityCore,
  isDeviceSideReason,
  type ConnectivityCore,
  type OfflineReason,
  type ProbeMeasure,
} from "./connectivityReducer";

const CFG: HysteresisConfig = { flipThreshold: 2, dwellMs: 10_000 };
const confirmed = (reachable: boolean, at = 0): HysteresisState => ({ reachable, streak: 0, lastFlipAt: at });
/** En ligne, lien rapide confirmé, aucune cause. */
const online = (): ConnectivityCore => ({ hysteresis: confirmed(true), latency: confirmed(true), reason: null });

const ok = (latencyMs = 80): ProbeMeasure => ({ ok: true, reason: null, latencyMs });
const failed = (reason: OfflineReason, latencyMs: number | null = null): ProbeMeasure => ({ ok: false, reason, latencyMs });

describe("applyProbe", () => {
  it("rien ne change quand tout va bien", () => {
    const applied = applyProbe(online(), ok(), 1_000, CFG);
    expect(applied.changed).toBe(false);
    expect(applied.wantConfirm).toBe(false);
    expect(applied.next.reason).toBeNull();
  });

  it("un premier échec note la cause et demande confirmation, sans basculer", () => {
    const applied = applyProbe(online(), failed("backend"), 1_000, CFG);
    expect(applied.next.hysteresis.reachable).toBe(true);
    expect(applied.wantConfirm).toBe(true);
    expect(applied.next.reason).toBe("backend");
    expect(applied.changed).toBe(true); // la cause seule a changé
  });

  it("deux délais dépassés d'affilée basculent hors ligne, cause « timeout »", () => {
    const first = applyProbe(online(), failed("timeout"), 1_000, CFG);
    const second = applyProbe(first.next, failed("timeout"), 4_000, CFG);
    expect(second.next.hysteresis.reachable).toBe(false);
    expect(second.next.reason).toBe("timeout");
    expect(second.changed).toBe(true);
  });

  it("un succès efface la cause", () => {
    const down: ConnectivityCore = { ...online(), hysteresis: confirmed(false), reason: "timeout" };
    const applied = applyProbe(down, ok(), 20_000, CFG);
    expect(applied.next.reason).toBeNull();
    expect(applied.changed).toBe(true);
  });

  it("sans lien côté appareil, un échec reste « network » — la sonde n'accuse pas le serveur", () => {
    const down: ConnectivityCore = { ...online(), hysteresis: confirmed(false), reason: "network" };
    const applied = applyProbe(down, failed("backend"), 16_000, CFG, true);
    expect(applied.next.reason).toBe("network");
    expect(applied.changed).toBe(false);
  });

  it("le lien revenu, la cause redevient celle de la sonde", () => {
    const down: ConnectivityCore = { ...online(), hysteresis: confirmed(false), reason: "network" };
    const applied = applyProbe(down, failed("backend"), 16_000, CFG, false);
    expect(applied.next.reason).toBe("backend");
    expect(applied.changed).toBe(true);
  });

  it("la qualité du lien suit la latence, sans toucher à la joignabilité", () => {
    const slowOnce = applyProbe(online(), ok(2_000), 1_000, CFG);
    expect(deriveLinkQuality(slowOnce.next.latency.reachable)).toBe("fast");
    const slowTwice = applyProbe(slowOnce.next, ok(2_000), 91_000, CFG);
    expect(deriveLinkQuality(slowTwice.next.latency.reachable)).toBe("slow");
    expect(slowTwice.next.hysteresis.reachable).toBe(true);
    expect(slowTwice.changed).toBe(true);
  });

  it("une sonde sans mesure garde la dernière qualité connue", () => {
    const core = online();
    const applied = applyProbe(core, failed("backend"), 1_000, CFG);
    expect(applied.next.latency).toBe(core.latency);
    expect(deriveLinkQuality(applied.next.latency.reachable)).toBe("fast");
  });

  it("part d'un cœur vierge : la première mesure fait vérité", () => {
    const applied = applyProbe(initialConnectivityCore, failed("timeout"), 1_000, CFG);
    expect(applied.next.hysteresis.reachable).toBe(false);
    expect(applied.next.reason).toBe("timeout");
  });
});

describe("isDeviceSideReason", () => {
  it("l'appareil pour « network » et « timeout », le serveur pour le reste", () => {
    expect(isDeviceSideReason("network")).toBe(true);
    expect(isDeviceSideReason("timeout")).toBe(true);
    expect(isDeviceSideReason("backend")).toBe(false);
    expect(isDeviceSideReason("jellyfin")).toBe(false);
    expect(isDeviceSideReason(null)).toBe(false);
  });
});
