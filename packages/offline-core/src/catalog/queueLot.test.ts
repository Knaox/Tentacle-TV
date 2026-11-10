import { describe, expect, it } from "vitest";
import type { OverviewEntry } from "./offlineOverview";
import { advanceQueueLot, type LotLiveReading, type QueueLot } from "./queueLot";

const entry = (id: number, patch: Partial<OverviewEntry>): OverviewEntry => ({
  id,
  status: "queued",
  bytesDone: 0,
  expectedSize: 100,
  ...patch,
});

/** Rejoue une suite d'états de la file comme le ferait l'écran, d'un rendu au suivant. */
function replay(states: OverviewEntry[][]) {
  let lot: QueueLot | null = null;
  return states.map((entries) => {
    const step = advanceQueueLot(lot, entries);
    lot = step.lot;
    return step.progress;
  });
}

describe("advanceQueueLot", () => {
  it("ne repart pas à zéro quand un épisode d'une saison se termine (défaut D)", () => {
    const progress = replay([
      [entry(1, { status: "downloading", bytesDone: 90 }), entry(2, {}), entry(3, {})],
      // L'épisode 1 est fini : avant le correctif, la barre retombait à 0 %
      // et le total passait de 300 à 200.
      [entry(1, { status: "complete", bytesDone: 100 }), entry(2, { status: "downloading", bytesDone: 0 }), entry(3, {})],
      [entry(1, { status: "complete", bytesDone: 100 }), entry(2, { status: "downloading", bytesDone: 50 }), entry(3, {})],
    ]);
    expect(progress.map((p) => p?.ratio)).toEqual([0.3, 100 / 300, 150 / 300]);
    expect(progress.map((p) => p?.bytesTotal)).toEqual([300, 300, 300]);
    expect(progress.map((p) => [p?.done, p?.count])).toEqual([[0, 3], [1, 3], [1, 3]]);
  });

  it("garde une barre monotone quand l'estimation d'un Allégé grossit en route", () => {
    const progress = replay([
      [entry(1, { status: "downloading", bytesDone: 50, expectedSize: 100 })],
      [entry(1, { status: "downloading", bytesDone: 55, expectedSize: 200 })],
      [entry(1, { status: "downloading", bytesDone: 160, expectedSize: 200 })],
    ]);
    expect(progress.map((p) => p?.ratio)).toEqual([0.5, 0.5, 0.8]);
  });

  it("ignore les titres prêts AVANT le lot, et se referme quand la file est vide", () => {
    const old = entry(9, { status: "complete", bytesDone: 1_000 });
    const progress = replay([
      [old, entry(1, { status: "downloading", bytesDone: 10 })],
      [old, entry(1, { status: "complete", bytesDone: 100 })],
      [old, entry(1, { status: "complete", bytesDone: 100 }), entry(2, { status: "downloading", bytesDone: 0 })],
    ]);
    expect(progress[0]).toMatchObject({ count: 1, done: 0, bytesTotal: 100 });
    expect(progress[1]).toBeNull();
    // Nouveau lot : l'épisode 1, fini dans le lot précédent, n'en fait plus partie.
    expect(progress[2]).toMatchObject({ count: 1, done: 0, ratio: 0 });
  });

  it("agrandit le lot quand on ajoute un titre en route, et le dit dans « n sur N »", () => {
    const progress = replay([
      [entry(1, { status: "complete", bytesDone: 100 }), entry(2, { status: "downloading", bytesDone: 100 - 1 })],
      [
        entry(1, { status: "complete", bytesDone: 100 }),
        entry(2, { status: "downloading", bytesDone: 99 }),
        entry(3, {}),
      ],
    ]);
    // Premier rendu : l'épisode 1 était fini avant qu'on observe la file.
    expect(progress[0]).toMatchObject({ count: 1, done: 0 });
    expect(progress[1]).toMatchObject({ count: 2, done: 0, bytesTotal: 200 });
  });

  it("retire du lot un titre annulé", () => {
    const progress = replay([
      [entry(1, { status: "downloading", bytesDone: 10 }), entry(2, {})],
      [entry(1, { status: "downloading", bytesDone: 10 }), entry(2, { status: "canceled" })],
    ]);
    expect(progress[1]).toMatchObject({ count: 1, bytesTotal: 100, ratio: 0.1 });
  });

  it("mesure en titres quand une taille manque, sans gonfler la barre", () => {
    const progress = replay([
      [entry(1, { status: "downloading", bytesDone: 0 }), entry(2, { expectedSize: null })],
      [entry(1, { status: "complete", bytesDone: 100 }), entry(2, { status: "downloading", expectedSize: null })],
    ]);
    expect(progress[0]?.ratio).toBe(0);
    expect(progress[1]?.ratio).toBe(0.5);
    expect(progress[1]?.etaSeconds).toBeNull();
  });

  it("additionne les débits en cours et en tire le temps restant", () => {
    const live = (id: number): LotLiveReading | undefined =>
      id === 1 ? { bytesDone: 40, expectedSize: 100, rateBps: 10 } : undefined;
    const step = advanceQueueLot(
      null,
      [entry(1, { status: "downloading" }), entry(2, { status: "queued" })],
      live,
    );
    expect(step.progress).toMatchObject({ bytesDone: 40, bytesTotal: 200, bytesPerSecond: 10, etaSeconds: 16 });
  });

  it("ne mesure aucun débit quand rien ne transite", () => {
    const step = advanceQueueLot(null, [entry(1, { status: "paused", bytesDone: 20 })]);
    expect(step.progress).toMatchObject({ bytesPerSecond: null, etaSeconds: null, ratio: 0.2 });
  });

  it("rend le même lot pour la même file (deux écrans qui lisent la file en même temps)", () => {
    const entries = [entry(1, { status: "downloading", bytesDone: 30 })];
    const first = advanceQueueLot(null, entries);
    const second = advanceQueueLot(first.lot, entries);
    expect(second.progress).toEqual(first.progress);
  });
});
