import { describe, expect, it } from "vitest";
import { decideJellyfinReturn, returnStallDeadline, RETURN_STALL_MS, RETURN_WATCH_MS, withinReturnWatch } from "./jellyfinReturn";

describe("le retour de Jellyfin", () => {
  it("une lecture qui a tenu sur sa réserve continue, sans rien recharger", () => {
    expect(decideJellyfinReturn({ started: true, failedDuringOutage: false })).toBe("resume");
  });

  it("le flux se rouvre si la lecture n'avait pas démarré, ou s'il est mort pendant la panne", () => {
    expect(decideJellyfinReturn({ started: false, failedDuringOutage: false })).toBe("reopen");
    expect(decideJellyfinReturn({ started: true, failedDuringOutage: true })).toBe("reopen");
  });

  it("la fenêtre d'après-retour dure RETURN_WATCH_MS", () => {
    expect(withinReturnWatch(1000, null)).toBe(false);
    expect(withinReturnWatch(1000 + RETURN_WATCH_MS - 1, 1000)).toBe(true);
    expect(withinReturnWatch(1000 + RETURN_WATCH_MS, 1000)).toBe(false);
  });

  it("une image arrêtée laisse au lecteur RETURN_STALL_MS pour se reconnecter seul", () => {
    // Arrêtée après le retour : depuis l'arrêt.
    expect(returnStallDeadline({ now: 0, returnedAt: 1000, stalledSince: 4000, reopened: false })).toBe(4000 + RETURN_STALL_MS);
    // Arrêtée PENDANT la panne : depuis le retour.
    expect(returnStallDeadline({ now: 0, returnedAt: 1000, stalledSince: 200, reopened: false })).toBe(1000 + RETURN_STALL_MS);
  });

  it("jamais deux réouvertures pour un retour, jamais hors fenêtre, jamais sans arrêt", () => {
    expect(returnStallDeadline({ now: 0, returnedAt: 1000, stalledSince: 2000, reopened: true })).toBeNull();
    expect(returnStallDeadline({ now: 0, returnedAt: 1000, stalledSince: null, reopened: false })).toBeNull();
    expect(returnStallDeadline({ now: 0, returnedAt: null, stalledSince: 2000, reopened: false })).toBeNull();
    expect(returnStallDeadline({ now: 0, returnedAt: 1000, stalledSince: 1000 + RETURN_WATCH_MS, reopened: false })).toBeNull();
  });
});
