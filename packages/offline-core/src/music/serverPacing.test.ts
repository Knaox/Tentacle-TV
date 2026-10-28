import { describe, expect, it } from "vitest";
import { keptTrack } from "./testing/fixtures";
import { readyInWords, serverPacingOf } from "./serverPacing";

const waiting = (retryAt: number | null) => keptTrack("ext:t", { status: "paused", pausedByUser: false, preparing: true, retryAt });

describe("serverPacingOf", () => {
  it("le serveur prépare à son rythme : « la suite arrive », prête à la plus lointaine relance qu'il a fixée", () => {
    expect(serverPacingOf([waiting(1_000 + 1_800_000), waiting(1_000 + 7_200_000), keptTrack("ext:t", { status: "complete" })], 1_000)).toEqual({ pacing: true, readyInMs: 7_200_000 });
  });

  it("un titre qui transfère : rien à dire", () => {
    expect(serverPacingOf([waiting(5_000), keptTrack("ext:t", { status: "downloading", preparing: false })], 1_000).pacing).toBe(false);
  });

  it("sans relance future, aucune estimation", () => {
    expect(serverPacingOf([waiting(null), waiting(500)], 1_000)).toEqual({ pacing: true, readyInMs: null });
  });

  it("rien qui se prépare (en pause demandée, tout gardé) : rien", () => {
    expect(serverPacingOf([keptTrack("ext:t", { status: "paused", pausedByUser: true, preparing: true })], 0).pacing).toBe(false);
    expect(serverPacingOf(null, 0).pacing).toBe(false);
  });
});

describe("readyInWords", () => {
  it("des minutes sous l'heure, des heures au-delà", () => {
    expect(readyInWords(10_000)).toEqual({ key: "transfers.readyInMinutes", count: 1 });
    expect(readyInWords(40 * 60_000)).toEqual({ key: "transfers.readyInMinutes", count: 40 });
    expect(readyInWords(2 * 3_600_000 + 10 * 60_000)).toEqual({ key: "transfers.readyInHours", count: 2 });
  });
});
