import { describe, expect, it } from "vitest";
import { drainOutcome, reportBody, reportRequest, serverIsNewer } from "./reportBody";

const at = Date.parse("2026-09-06T21:30:00.000Z");
const played = { id: 3, itemId: "ep1", positionTicks: 0, played: true, occurredAtUtc: at };
const partial = { id: 4, itemId: "ep2", positionTicks: 6_000_000_000, played: false, occurredAtUtc: at };

describe("reportRequest", () => {
  it("un titre vu passe par « marquer comme lu », date réelle comprise", () => {
    const req = reportRequest(played, "user-1");
    expect(req.method).toBe("POST");
    expect(req.path).toBe(`Users/user-1/PlayedItems/ep1?datePlayed=${encodeURIComponent("2026-09-06T21:30:00.000Z")}`);
    expect(req.body).toBeNull();
  });

  it("un arrêt partiel n'envoie que la position et la date — jamais Played", () => {
    const req = reportRequest(partial, "user-1");
    expect(req.path).toBe("UserItems/ep2/UserData");
    expect(req.body).toEqual({ PlaybackPositionTicks: 6_000_000_000, LastPlayedDate: "2026-09-06T21:30:00.000Z" });
    expect(Object.keys(req.body ?? {})).not.toContain("Played");
  });

  it("le corps historique du bureau ne change pas", () => {
    expect(reportBody(played)).toEqual({ PlaybackPositionTicks: 0, Played: true, LastPlayedDate: "2026-09-06T21:30:00.000Z" });
    expect(reportBody(partial)).toEqual({ PlaybackPositionTicks: 6_000_000_000, Played: false });
  });
});

describe("drainOutcome", () => {
  it("classe les statuts", () => {
    expect(drainOutcome(200)).toBe("synced");
    expect(drainOutcome(204)).toBe("synced");
    expect(drainOutcome(404)).toBe("skipped");
    expect(drainOutcome(410)).toBe("skipped");
    expect(drainOutcome(400)).toBe("skipped");
    expect(drainOutcome(401)).toBe("stop");
    expect(drainOutcome(429)).toBe("stop");
    expect(drainOutcome(503)).toBe("stop");
    expect(drainOutcome(null)).toBe("stop");
  });
});

describe("serverIsNewer", () => {
  it("ne cède qu'à une date serveur postérieure au rapport", () => {
    expect(serverIsNewer(partial, undefined)).toBe(false);
    expect(serverIsNewer(partial, { itemId: "ep2", played: false, positionTicks: 1, lastPlayedAtMs: null })).toBe(false);
    expect(serverIsNewer(partial, { itemId: "ep2", played: false, positionTicks: 1, lastPlayedAtMs: at - 1 })).toBe(false);
    expect(serverIsNewer(partial, { itemId: "ep2", played: true, positionTicks: 0, lastPlayedAtMs: at + 1 })).toBe(true);
  });
});
