import { describe, expect, it } from "vitest";
import { MAX_RECOVERIES, MidTrackRecovery, RECOVERY_MARGIN_MS, RECOVERY_PROGRESS_MS, recoveryStartMs } from "./midTrackRecovery";

describe("recoveryStartMs", () => {
  it("reprend d'abord à la position même, puis saute au-delà de la zone abîmée", () => {
    expect(recoveryStartMs(16_800, 143_000, 0)).toBe(16_800);
    expect(recoveryStartMs(16_800, 143_000, 1)).toBe(17_550);
    expect(recoveryStartMs(16_800, 143_000, 2)).toBe(19_300);
    expect(recoveryStartMs(16_800, 143_000, MAX_RECOVERIES)).toBeNull();
  });

  it("une fin près de la durée annoncée est la vraie fin", () => {
    expect(recoveryStartMs(143_000 - RECOVERY_MARGIN_MS + 1, 143_000, 0)).toBeNull();
  });

  it("jamais sans durée connue, ni avant le premier son", () => {
    expect(recoveryStartMs(5_000, null, 0)).toBeNull();
    expect(recoveryStartMs(0, 143_000, 0)).toBeNull();
  });

  it("le saut ne dépasse jamais la fin", () => {
    expect(recoveryStartMs(140_000, 143_000, 2)).toBe(143_000 - RECOVERY_MARGIN_MS);
  });
});

describe("MidTrackRecovery", () => {
  it("un défaut qui revient au même endroit : trois reprises, de plus en plus loin, puis la fin", () => {
    const r = new MidTrackRecovery();
    r.played("t", 16_800);
    expect(r.take("t", 143_000)).toBe(16_800);
    expect(r.take("t", 143_000)).toBe(17_550);
    expect(r.take("t", 143_000)).toBe(20_050);
    expect(r.take("t", 143_000)).toBeNull();
  });

  it("une lecture qui a repris nettement redonne ses reprises à un défaut plus loin", () => {
    const r = new MidTrackRecovery();
    r.played("t", 16_800);
    r.take("t", 143_000);
    r.take("t", 143_000);
    r.played("t", 17_550 + RECOVERY_PROGRESS_MS);
    expect(r.take("t", 143_000)).toBe(17_550 + RECOVERY_PROGRESS_MS);
  });

  it("un autre titre repart de zéro", () => {
    const r = new MidTrackRecovery();
    r.played("a", 10_000);
    r.take("a", 100_000);
    expect(r.take("b", 100_000)).toBeNull();
  });
});
