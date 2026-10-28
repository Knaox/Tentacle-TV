import { describe, expect, it } from "vitest";
import { offlineEntryHint, type TransferSummaryView } from "./offlineEntryHint";

const quiet: TransferSummaryView = { active: false, done: 0, total: 0, running: 0, pausedByUser: 0, failed: 0, fraction: 0 };

describe("sous-titre de l'entrée « Hors ligne » du hub", () => {
  it("rien en cours (ou résumé pas encore lu) : la phrase de repos", () => {
    expect(offlineEntryHint(null)).toEqual({ kind: "idle" });
    expect(offlineEntryHint(quiet)).toEqual({ kind: "idle" });
  });

  it("des transferts tournent : ce qui reste et le pourcentage, arrondi vers le bas", () => {
    expect(offlineEntryHint({ ...quiet, active: true, total: 10, done: 7, running: 2, fraction: 0.429 })).toEqual({ kind: "running", left: 3, percent: 42 });
  });

  it("le pourcentage reste entre 0 et 100", () => {
    expect(offlineEntryHint({ ...quiet, active: true, total: 1, running: 1, fraction: 1.2 })).toMatchObject({ percent: 100 });
  });

  it("rien ne tourne : le défaut avant la pause", () => {
    expect(offlineEntryHint({ ...quiet, active: true, total: 4, failed: 1, pausedByUser: 2 })).toEqual({ kind: "failed", count: 1 });
    expect(offlineEntryHint({ ...quiet, active: true, total: 4, pausedByUser: 2 })).toEqual({ kind: "paused", count: 2 });
  });
});
