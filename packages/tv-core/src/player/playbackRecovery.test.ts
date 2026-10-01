import { describe, expect, it } from "vitest";
import {
  decideRecovery, MAX_VAIN_RESTARTS, PROBE_EVERY_MS, RESTART_COOLDOWN_MS, SLOW_RESTART_AFTER_MS, STALL_GRACE_MS,
  STARVING_PROBE_MS, type RecoveryInput,
} from "./playbackRecovery";

const T = 1_000_000;

/** Une lecture qui avance, tous serveurs joignables, rien en cours. */
function playing(over: Partial<RecoveryInput> = {}): RecoveryInput {
  return {
    now: T, started: true, paused: false, ended: false,
    stalledSince: null, lostSince: null, openSince: null, ahead: 10, starvingSince: null,
    tentacle: "ok", source: "unknown", sourceCulprit: null, sourceCheckedAt: null, probing: false,
    downSince: null, downWhat: null,
    restarting: false, lastRestartAt: null, vainRestarts: 0,
    ...over,
  };
}

describe("decideRecovery — la lecture avance", () => {
  it("rien à dire, rien à sonder", () => {
    expect(decideRecovery(playing())).toEqual({ phase: { kind: "none" }, probe: false, restart: false });
  });

  it("avant la première image ou après la fin : l'écran de chargement et l'arbitre s'en chargent", () => {
    expect(decideRecovery(playing({ started: false, stalledSince: T - 60_000 })).phase.kind).toBe("none");
    expect(decideRecovery(playing({ ended: true, lostSince: T - 1 })).phase.kind).toBe("none");
  });

  it("ce qui est chargé fond sans être remplacé : une sonde, avant l'arrêt", () => {
    expect(decideRecovery(playing({ starvingSince: T - STARVING_PROBE_MS + 1 })).probe).toBe(false);
    expect(decideRecovery(playing({ starvingSince: T - STARVING_PROBE_MS })).probe).toBe(true);
  });

  it("Jellyfin à terre : la lecture continue sur ce qui est chargé, on le dit", () => {
    const d = decideRecovery(playing({ source: "down", sourceCulprit: "media", sourceCheckedAt: T - PROBE_EVERY_MS, ahead: 34, downSince: T - 9000 }));
    expect(d.phase).toEqual({ kind: "degraded", cause: "media", ahead: 34, since: T - 9000, streamAffected: true });
    expect(d.probe).toBe(true);
    expect(d.restart).toBe(false);
  });

  it("Tentacle seul à terre, flux direct : on le dit, sans sonder la source", () => {
    const d = decideRecovery(playing({ tentacle: "down", source: "ok", sourceCheckedAt: T - 60_000 }));
    expect(d.phase).toMatchObject({ kind: "degraded", cause: "tentacle", streamAffected: false });
    expect(d.probe).toBe(false);
  });

  it("Tentacle à terre derrière un flux par le proxy : le flux en dépend, on le dit", () => {
    const d = decideRecovery(playing({ tentacle: "down", source: "down", sourceCulprit: "tentacle", sourceCheckedAt: T - 100, ahead: 22 }));
    expect(d.phase).toMatchObject({ kind: "degraded", cause: "tentacle", ahead: 22, streamAffected: true });
  });
});

describe("decideRecovery — la lecture s'arrête", () => {
  it("un arrêt bref ne dit rien (remplissage ordinaire), une pause non plus", () => {
    expect(decideRecovery(playing({ stalledSince: T - STALL_GRACE_MS + 1 })).phase.kind).toBe("none");
    expect(decideRecovery(playing({ stalledSince: T - 60_000, paused: true })).phase.kind).toBe("none");
  });

  it("arrêt sans sonde récente : on attend, on sonde tout de suite", () => {
    const d = decideRecovery(playing({ stalledSince: T - STALL_GRACE_MS, source: "ok", sourceCheckedAt: T - 60_000 }));
    expect(d.phase).toMatchObject({ kind: "waiting", cause: "network" });
    expect(d.probe).toBe(true);
    expect(d.restart).toBe(false);
  });

  it("une sonde en vol n'en relance pas une autre", () => {
    expect(decideRecovery(playing({ stalledSince: T - 5000, probing: true })).probe).toBe(false);
  });

  it("source à terre : on attend, sondes espacées, jamais de relance", () => {
    const base = playing({ stalledSince: T - 30_000, source: "down", sourceCulprit: "media", downSince: T - 40_000, downWhat: "media" });
    expect(decideRecovery({ ...base, sourceCheckedAt: T - 1000 })).toEqual({
      phase: { kind: "waiting", cause: "media", since: T - 30_000 }, probe: false, restart: false,
    });
    expect(decideRecovery({ ...base, sourceCheckedAt: T - PROBE_EVERY_MS }).probe).toBe(true);
  });

  it("Tentacle à terre derrière un flux par le proxy : c'est lui qu'on nomme", () => {
    const d = decideRecovery(playing({ stalledSince: T - 10_000, source: "down", sourceCulprit: "tentacle", sourceCheckedAt: T - 100 }));
    expect(d.phase).toMatchObject({ kind: "waiting", cause: "tentacle" });
  });

  it("le serveur revient : relance immédiate, à la sonde qui le dit", () => {
    const d = decideRecovery(playing({
      stalledSince: T - 60_000, source: "ok", sourceCheckedAt: T - 10, downSince: T - 70_000, downWhat: "media",
    }));
    expect(d).toEqual({ phase: { kind: "waiting", cause: "media", since: T - 60_000 }, probe: false, restart: true });
  });

  it("une sonde d'AVANT l'arrêt ne vaut rien : on resonde avant de relancer", () => {
    const d = decideRecovery(playing({ stalledSince: T - 8000, source: "ok", sourceCheckedAt: T - 9000, downSince: T - 20_000, downWhat: "media" }));
    expect(d.restart).toBe(false);
    expect(d.probe).toBe(true);
  });

  it("la source perdue (erreur du lecteur), serveur joignable : relance immédiate", () => {
    const d = decideRecovery(playing({ lostSince: T - 500, source: "ok", sourceCheckedAt: T - 100 }));
    expect(d.restart).toBe(true);
    expect(d.phase).toMatchObject({ kind: "waiting", cause: "network" });
  });

  it("un arrêt de débit, serveur joignable : le remplissage d'abord, la relance ensuite", () => {
    const stalled = (ms: number) => playing({ stalledSince: T - ms, source: "ok", sourceCheckedAt: T - 100 });
    expect(decideRecovery(stalled(SLOW_RESTART_AFTER_MS - 1))).toMatchObject({ phase: { kind: "waiting", cause: "slow" }, restart: false });
    expect(decideRecovery(stalled(SLOW_RESTART_AFTER_MS)).restart).toBe(true);
  });

  it("une relance à la fois, et le temps au flux relancé de démarrer", () => {
    const back = playing({ stalledSince: T - 60_000, source: "ok", sourceCheckedAt: T - 10, downSince: T - 70_000, downWhat: "media" });
    expect(decideRecovery({ ...back, restarting: true })).toMatchObject({ phase: { kind: "recovering" }, restart: false });
    expect(decideRecovery({ ...back, lastRestartAt: T - RESTART_COOLDOWN_MS + 1 }).restart).toBe(false);
    expect(decideRecovery({ ...back, lastRestartAt: T - RESTART_COOLDOWN_MS }).restart).toBe(true);
  });

  it("une relance garde l'incident ouvert sans le requalifier : un débit reste un débit", () => {
    const d = decideRecovery(playing({ openSince: T - 30_000, source: "ok", sourceCheckedAt: T - 100, lastRestartAt: T - RESTART_COOLDOWN_MS }));
    expect(d.phase).toMatchObject({ kind: "waiting", cause: "slow", since: T - 30_000 });
    expect(d.restart).toBe(true);
  });

  it("le flux relancé n'a pas encore avancé : « reprise en cours », sans autre relance", () => {
    const d = decideRecovery(playing({ openSince: T - 5000, restarting: true, downSince: T - 60_000, downWhat: "media", source: "ok", sourceCheckedAt: T - 5000 }));
    expect(d).toEqual({ phase: { kind: "recovering", cause: "media", since: T - 5000 }, probe: false, restart: false });
  });

  it("relances vaines, serveur joignable : la main à l'utilisateur", () => {
    const d = decideRecovery(playing({ lostSince: T - 60_000, source: "ok", sourceCheckedAt: T - 10, vainRestarts: MAX_VAIN_RESTARTS }));
    expect(d).toEqual({ phase: { kind: "stuck", cause: "network", since: T - 60_000 }, probe: false, restart: false });
  });
});
