import { describe, expect, it } from "vitest";
import {
  decideSeekLanding, initialSeekBackoffS, MPV_HLS_SEEK_BACKOFF_MAX_S, MPV_HLS_SEEK_BACKOFF_S,
} from "./mpvSeekLanding";

describe("initialSeekBackoffS", () => {
  it("douze secondes de recul sur un HLS, aucun en lecture directe", () => {
    expect(initialSeekBackoffS(true)).toBe(MPV_HLS_SEEK_BACKOFF_S);
    expect(initialSeekBackoffS(false)).toBe(0);
  });
});

describe("decideSeekLanding", () => {
  it("posé : exact, en avance, ou dans la tolérance", () => {
    expect(decideSeekLanding({ targetS: 500, landedS: 500.017, backoffS: 12, isHls: true, relandings: 0 })).toEqual({ kind: "landed" });
    expect(decideSeekLanding({ targetS: 500, landedS: 499.2, backoffS: 12, isHls: true, relandings: 0 })).toEqual({ kind: "landed" });
    expect(decideSeekLanding({ targetS: 500, landedS: 500.6, backoffS: 12, isHls: true, relandings: 0 })).toEqual({ kind: "landed" });
  });

  it("en lecture directe, un retard n'est pas notre affaire", () => {
    expect(decideSeekLanding({ targetS: 500, landedS: 503, backoffS: 0, isHls: false, relandings: 0 })).toEqual({ kind: "landed" });
  });

  it("en retard sur un HLS : le recul s'élargit du retard plus une marge, et le seek se refait une fois", () => {
    // Le cas mesuré : 100 → 102,060 sans recul suffisant.
    expect(decideSeekLanding({ targetS: 100, landedS: 102.06, backoffS: 12, isHls: true, relandings: 0 }))
      .toEqual({ kind: "late", lateS: expect.closeTo(2.06, 3), backoffS: 18, reseek: true });
    expect(decideSeekLanding({ targetS: 100, landedS: 102.06, backoffS: 18, isHls: true, relandings: 1 }))
      .toMatchObject({ kind: "late", backoffS: 24, reseek: false });
  });

  it("le recul est plafonné, et un plafond atteint ne relance rien", () => {
    const decision = decideSeekLanding({ targetS: 100, landedS: 130, backoffS: 28, isHls: true, relandings: 0 });
    expect(decision).toMatchObject({ kind: "late", backoffS: MPV_HLS_SEEK_BACKOFF_MAX_S, reseek: true });
    expect(decideSeekLanding({ targetS: 100, landedS: 130, backoffS: MPV_HLS_SEEK_BACKOFF_MAX_S, isHls: true, relandings: 0 }))
      .toMatchObject({ kind: "late", reseek: false });
  });
});
