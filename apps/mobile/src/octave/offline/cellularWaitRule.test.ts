import { describe, expect, it } from "vitest";
import { cellularWaitCount } from "./cellularWaitRule";

const track = (status: "queued" | "downloading" | "paused" | "complete" | "error", pausedByUser = false) => ({ status, pausedByUser });

describe("le message des données cellulaires (Octave)", () => {
  const lot = [track("queued"), track("queued"), track("paused"), track("paused", true), track("complete"), track("error")];

  it("données mobiles, réglage coupé : les titres en file et en pause système attendent le Wi-Fi", () => {
    expect(cellularWaitCount(lot, true)).toBe(3);
  });

  it("Wi-Fi revenu, ou réglage allumé : plus de message, la file repart", () => {
    expect(cellularWaitCount(lot, false)).toBe(0);
  });

  it("rien qui attende (tout gardé, une pause demandée) : pas de message", () => {
    expect(cellularWaitCount([track("complete"), track("paused", true)], true)).toBe(0);
    expect(cellularWaitCount(null, true)).toBe(0);
  });
});
