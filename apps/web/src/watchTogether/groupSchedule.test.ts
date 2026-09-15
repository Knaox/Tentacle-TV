import { describe, expect, it } from "vitest";
import {
  computePlayDelayMs, isFutureAnchor, needsPreseek, pendingIntentUntil, updatePlayLatency,
} from "./groupSchedule";

describe("isFutureAnchor", () => {
  it("vrai quand la salle joue depuis un instant encore à venir", () => {
    expect(isFutureAnchor({ paused: false, stateAtServerTime: 1_000 }, 800)).toBe(true);
    expect(isFutureAnchor({ paused: false, stateAtServerTime: 1_000 }, 1_000)).toBe(false);
    expect(isFutureAnchor({ paused: true, stateAtServerTime: 1_000 }, 800)).toBe(false);
  });
});

describe("computePlayDelayMs", () => {
  it("part en avance de la latence de démarrage, jamais dans le passé", () => {
    expect(computePlayDelayMs(1_500, 1_000, 60)).toBe(440);
    expect(computePlayDelayMs(1_500, 1_000, null)).toBe(500);
    expect(computePlayDelayMs(1_000, 1_200, 60)).toBe(0);
  });
});

describe("pendingIntentUntil", () => {
  it("au moins le plancher, ou deux allers-retours", () => {
    expect(pendingIntentUntil(10_000, 40)).toBe(11_500);
    expect(pendingIntentUntil(10_000, 1_000)).toBe(12_000);
    expect(pendingIntentUntil(10_000, null)).toBe(11_500);
  });
});

describe("updatePlayLatency", () => {
  it("prend la première mesure telle quelle, puis lisse, toujours bornée", () => {
    expect(updatePlayLatency(null, 80)).toBe(80);
    expect(updatePlayLatency(80, 180)).toBe(110);
    expect(updatePlayLatency(null, 2_000)).toBe(300);
    expect(updatePlayLatency(100, -50)).toBe(70);
  });
});

describe("needsPreseek", () => {
  it("seulement au-delà de la tolérance", () => {
    expect(needsPreseek(10, 10.03)).toBe(false);
    expect(needsPreseek(10, 10.05)).toBe(true);
  });
});
