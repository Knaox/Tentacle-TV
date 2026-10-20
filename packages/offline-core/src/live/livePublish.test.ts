import { describe, expect, it } from "vitest";
import { nextLiveEstimate, shouldPublishEstimate } from "./liveEstimate";
import { INITIAL_LIVE_STATE, nextLivePublish, type LivePublishState } from "./livePublish";
import type { LiveTransferView } from "./liveTransfer";

function view(over: Partial<LiveTransferView> = {}): LiveTransferView {
  return {
    phase: "transferring",
    remaining: 2,
    total: 3,
    fraction: 0.4,
    rawEtaMs: 600_000,
    single: null,
    seriesName: null,
    ...over,
  };
}

describe("nextLiveEstimate", () => {
  it("la première mesure pose la fin telle quelle", () => {
    expect(nextLiveEstimate(null, 60_000, 1_000)).toEqual({ endsAtMs: 61_000, updatedAtMs: 1_000 });
  });

  it("une fin stable fait un compte à rebours qui descend seconde par seconde", () => {
    const first = nextLiveEstimate(null, 600_000, 0)!;
    const next = nextLiveEstimate(first, 590_000, 10_000)!;
    expect(next.endsAtMs).toBe(600_000);
  });

  it("un pic de débit ne déplace la fin que d'une fraction", () => {
    const first = nextLiveEstimate(null, 600_000, 0)!;
    // Débit doublé une seconde : la fin brute recule de 5 min, la lissée de quelques secondes.
    const next = nextLiveEstimate(first, 300_000, 1_000)!;
    expect(600_000 - next.endsAtMs).toBeLessThan(20_000);
    expect(next.endsAtMs).toBeLessThan(600_000);
  });

  it("sans mesure (attente) l'estimation s'efface", () => {
    expect(nextLiveEstimate({ endsAtMs: 5, updatedAtMs: 0 }, null, 1)).toBeNull();
  });

  it("jamais une fin déjà passée", () => {
    const next = nextLiveEstimate({ endsAtMs: 0, updatedAtMs: 0 }, 0, 100_000)!;
    expect(next.endsAtMs).toBeGreaterThan(100_000);
  });
});

describe("shouldPublishEstimate", () => {
  it("un écart de quelques secondes ne republie pas", () => {
    expect(shouldPublishEstimate(600_000, 610_000, 0)).toBe(false);
  });
  it("un écart franc republie", () => {
    expect(shouldPublishEstimate(600_000, 700_000, 0)).toBe(true);
  });
  it("sur un long transfert, le seuil suit 10 % du restant", () => {
    expect(shouldPublishEstimate(3_600_000, 3_600_000 + 60_000, 0)).toBe(false);
  });
  it("apparition ou disparition d'une fin : toujours", () => {
    expect(shouldPublishEstimate(null, 5, 0)).toBe(true);
    expect(shouldPublishEstimate(5, null, 0)).toBe(true);
  });
});

describe("nextLivePublish", () => {
  it("démarre, puis ne republie pas sans changement notable", () => {
    const first = nextLivePublish(INITIAL_LIVE_STATE, view(), 0);
    expect(first.action.kind).toBe("start");
    const second = nextLivePublish(first.state, view({ rawEtaMs: 595_000, fraction: 0.41 }), 5_000);
    expect(second.action.kind).toBe("none");
  });

  it("une attente se dit tout de suite, sans fin estimée", () => {
    const first = nextLivePublish(INITIAL_LIVE_STATE, view(), 0);
    const waiting = nextLivePublish(first.state, view({ phase: "waitingWifi", rawEtaMs: null }), 1_000);
    expect(waiting.action).toMatchObject({ kind: "update", content: { phase: "waitingWifi", endsAtMs: null } });
  });

  it("un titre de moins se dit tout de suite", () => {
    const first = nextLivePublish(INITIAL_LIVE_STATE, view(), 0);
    expect(nextLivePublish(first.state, view({ remaining: 1 }), 500).action.kind).toBe("update");
  });

  it("la barre avance par pas de 5 %, au plus toutes les 10 s", () => {
    let state: LivePublishState = nextLivePublish(INITIAL_LIVE_STATE, view({ fraction: 0.4 }), 0).state;
    const early = nextLivePublish(state, view({ fraction: 0.5, rawEtaMs: 590_000 }), 5_000);
    expect(early.action.kind).toBe("none");
    state = early.state;
    expect(nextLivePublish(state, view({ fraction: 0.5, rawEtaMs: 585_000 }), 15_000).action.kind).toBe("update");
  });

  it("plus rien en attente : l'activité se termine", () => {
    const first = nextLivePublish(INITIAL_LIVE_STATE, view(), 0);
    const end = nextLivePublish(first.state, null, 1_000);
    expect(end.action.kind).toBe("end");
    expect(end.state).toBe(INITIAL_LIVE_STATE);
    expect(nextLivePublish(end.state, null, 2_000).action.kind).toBe("none");
  });
  it("forcé (passage derrière, démarrage à retenter) : l'état du moment est redessiné", () => {
    const first = nextLivePublish(INITIAL_LIVE_STATE, view({ fraction: 0.4 }), 0);
    const quiet = nextLivePublish(first.state, view({ fraction: 0.42 }), 1_000);
    expect(quiet.action.kind).toBe("none");
    const forced = nextLivePublish(first.state, view({ fraction: 0.42 }), 1_000, { force: true });
    expect(forced.action).toMatchObject({ kind: "update", content: { percent: 42 } });
  });

  it("forcé sans rien à suivre : la fin, jamais un dessin", () => {
    const first = nextLivePublish(INITIAL_LIVE_STATE, view(), 0);
    expect(nextLivePublish(first.state, null, 1_000, { force: true }).action.kind).toBe("end");
  });
});
