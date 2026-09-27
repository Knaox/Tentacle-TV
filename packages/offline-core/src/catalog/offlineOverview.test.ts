import { describe, expect, it } from "vitest";
import { readyBytesOf, summarizeOffline, type OverviewEntry } from "./offlineOverview";

const entry = (id: number, patch: Partial<OverviewEntry>): OverviewEntry => ({
  id,
  status: "complete",
  bytesDone: 0,
  expectedSize: null,
  ...patch,
});

describe("summarizeOffline", () => {
  it("compte chaque état et additionne l'espace des titres prêts", () => {
    const overview = summarizeOffline([
      entry(1, { status: "complete", bytesDone: 100 }),
      entry(2, { status: "complete", bytesDone: 50 }),
      entry(3, { status: "downloading", bytesDone: 10, expectedSize: 40 }),
      entry(4, { status: "queued", expectedSize: 60 }),
      entry(5, { status: "paused", pausedByUser: true, bytesDone: 5, expectedSize: 10 }),
      entry(6, { status: "paused", pausedByUser: false }),
      entry(7, { status: "error", bytesDone: 2, expectedSize: 10 }),
      entry(8, { status: "canceled", bytesDone: 99, expectedSize: 99 }),
    ]);
    expect(overview).toMatchObject({ ready: 2, readyBytes: 150, running: 2, paused: 2, heldByUser: 1, errors: 1 });
    // Les annulés ne pèsent pas dans la barre globale.
    expect(overview.transferDone).toBe(17);
    expect(overview.transferTotal).toBe(120);
    expect(overview.transferRatio).toBeCloseTo(17 / 120);
  });

  it("n'invente pas d'avancement sans taille connue", () => {
    const overview = summarizeOffline([entry(1, { status: "downloading", bytesDone: 10 })]);
    expect(overview.running).toBe(1);
    expect(overview.transferRatio).toBeNull();
  });

  it("préfère la lecture en direct à la valeur de la base", () => {
    const overview = summarizeOffline(
      [entry(1, { status: "downloading", bytesDone: 10, expectedSize: 100 })],
      (id) => (id === 1 ? { bytesDone: 80, expectedSize: 100 } : undefined),
    );
    expect(overview.transferRatio).toBeCloseTo(0.8);
  });

  it("plafonne un octet reçu au-delà de la taille annoncée", () => {
    const overview = summarizeOffline([entry(1, { status: "downloading", bytesDone: 150, expectedSize: 100 })]);
    expect(overview.transferRatio).toBe(1);
  });

  it("rend une file vide sans ratio", () => {
    expect(summarizeOffline([]).transferRatio).toBeNull();
  });
});

describe("readyBytesOf", () => {
  it("n'additionne que les titres prêts", () => {
    expect(
      readyBytesOf([
        entry(1, { status: "complete", bytesDone: 30 }),
        entry(2, { status: "downloading", bytesDone: 70 }),
      ]),
    ).toBe(30);
  });
});
