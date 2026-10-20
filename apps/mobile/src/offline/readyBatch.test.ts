import { describe, expect, it } from "vitest";
import { INITIAL_READY_STATE, nextReadyStep, type ReadyEntry, type ReadyState } from "./readyBatch";

const e = (id: number, status: string, errorCode: string | null = null): ReadyEntry => ({ id, status, errorCode });

function run(steps: ReadyEntry[][]) {
  let state: ReadyState<ReadyEntry> = INITIAL_READY_STATE;
  const announced: number[][] = [];
  for (const entries of steps) {
    const step = nextReadyStep(state, entries);
    state = step.state;
    if (step.ready.length > 0) announced.push(step.ready.map((entry) => entry.id));
  }
  return announced;
}

describe("« Prêt à regarder hors ligne »", () => {
  it("un lot se dit UNE fois, quand le dernier transfert finit", () => {
    expect(run([[e(1, "downloading"), e(2, "queued")], [e(1, "complete"), e(2, "downloading")], [e(1, "complete"), e(2, "complete")]])).toEqual([[1, 2]]);
  });

  it("un titre en pause — ou qui attend le Wi-Fi — n'empêche plus d'annoncer les autres (recette D4)", () => {
    expect(run([[e(1, "downloading"), e(2, "paused")], [e(1, "complete"), e(2, "paused")]])).toEqual([[1]]);
  });

  it("le titre en pause se dit à son tour, sans redire les premiers", () => {
    expect(
      run([
        [e(1, "downloading"), e(2, "paused")],
        [e(1, "complete"), e(2, "paused")],
        [e(1, "complete"), e(2, "downloading")],
        [e(1, "complete"), e(2, "complete")],
      ]),
    ).toEqual([[1], [2]]);
  });

  it("la première photo ne dit rien : un titre déjà prêt au lancement ne s'annonce pas", () => {
    expect(run([[e(1, "complete")], [e(1, "complete")]])).toEqual([]);
  });

  it("un titre prêt puis retiré avant la fin du lot ne se dit pas", () => {
    expect(run([[e(1, "downloading"), e(2, "downloading")], [e(1, "complete"), e(2, "downloading")], [e(2, "complete")]])).toEqual([[2]]);
  });

  it("un arrêt faute de place se signale aussitôt, un démarrage aussi", () => {
    let state: ReadyState<ReadyEntry> = INITIAL_READY_STATE;
    state = nextReadyStep(state, [e(1, "paused")]).state;
    const start = nextReadyStep(state, [e(1, "downloading")]);
    expect(start.started).toBe(true);
    const full = nextReadyStep(start.state, [e(1, "error", "disk-full")]);
    expect(full.diskFull.map((entry) => entry.id)).toEqual([1]);
  });
});
