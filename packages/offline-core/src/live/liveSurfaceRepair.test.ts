import { describe, expect, it } from "vitest";
import { LIVE_RETRY_MIN_INTERVAL_MS, liveAppStateAction, liveRetryOnTick } from "./liveSurfaceRepair";

describe("liveAppStateAction", () => {
  it("retour au premier plan après un démarrage refusé : on repose l'activité", () => {
    expect(liveAppStateAction({ appState: "active", wanted: true, outcome: "refused" })).toBe("republish");
  });

  it("retour au premier plan, activité visible : rien à refaire", () => {
    expect(liveAppStateAction({ appState: "active", wanted: true, outcome: "shown" })).toBe("none");
    expect(liveAppStateAction({ appState: "active", wanted: true, outcome: "pending" })).toBe("none");
  });

  it("passage derrière : l'état du moment est republié avant la suspension", () => {
    expect(liveAppStateAction({ appState: "inactive", wanted: true, outcome: "shown" })).toBe("republish");
    expect(liveAppStateAction({ appState: "background", wanted: true, outcome: "refused" })).toBe("republish");
  });

  it("rien à suivre : rien, quel que soit l'état", () => {
    for (const appState of ["active", "inactive", "background"] as const) {
      expect(liveAppStateAction({ appState, wanted: false, outcome: "refused" })).toBe("none");
    }
  });

  it("fermée par la personne : jamais reposée pour ce lot", () => {
    for (const appState of ["active", "inactive", "background"] as const) {
      expect(liveAppStateAction({ appState, wanted: true, outcome: "dismissed" })).toBe("none");
    }
  });
});

describe("liveRetryOnTick", () => {
  it("un refus au premier plan se retente, au plus toutes les 10 s", () => {
    expect(liveRetryOnTick({ appState: "active", outcome: "refused", sinceLastAttemptMs: LIVE_RETRY_MIN_INTERVAL_MS })).toBe(true);
    expect(liveRetryOnTick({ appState: "active", outcome: "refused", sinceLastAttemptMs: 2_000 })).toBe(false);
  });

  it("derrière, iOS refuserait encore : pas de nouvelle demande", () => {
    expect(liveRetryOnTick({ appState: "background", outcome: "refused", sinceLastAttemptMs: 60_000 })).toBe(false);
  });

  it("une activité visible ne se redemande pas", () => {
    expect(liveRetryOnTick({ appState: "active", outcome: "shown", sinceLastAttemptMs: 60_000 })).toBe(false);
  });
});
