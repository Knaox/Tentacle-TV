import { describe, expect, it } from "vitest";
import { RETURN_RESTART_SKIP_MS, restartOnJellyfinReturn, serverOutageProbe } from "./serverOutage";
import { decideRecovery, type RecoveryInput } from "./playbackRecovery";

/** L'état de Jellyfin dit par le serveur, dans la décision de reprise des téléviseurs. */

const base: RecoveryInput = {
  now: 100_000, started: true, paused: false, ended: false, stalledSince: null, lostSince: null, openSince: null,
  ahead: 20, starvingSince: null, tentacle: "ok", source: "ok", sourceCulprit: null, sourceCheckedAt: null,
  probing: false, downSince: null, downWhat: null, restarting: false, lastRestartAt: null, vainRestarts: 0,
  transcoding: true, lastProgressAt: null, measuredBps: null, neededBps: null, retryAsked: false, lastReloadAt: null,
};

describe("l'état de Jellyfin dit par le serveur", () => {
  it("en panne, l'image tient encore : le bandeau le dit tout de suite (Jellyfin en cause)", () => {
    const probe = serverOutageProbe(base.now, { downSince: null, downWhat: null });
    const d = decideRecovery({ ...base, source: probe.source, sourceCulprit: probe.culprit, sourceCheckedAt: probe.checkedAt, downSince: probe.downSince, downWhat: probe.downWhat });
    expect(d.phase).toMatchObject({ kind: "degraded", cause: "media", streamAffected: true });
    expect(d.restart).toBe(false);
  });

  it("en panne, l'image arrêtée : on attend, sans relance vaine", () => {
    const probe = serverOutageProbe(base.now, { downSince: 90_000, downWhat: "media" });
    expect(probe.downSince).toBe(90_000);
    const d = decideRecovery({ ...base, stalledSince: 80_000, source: "down", sourceCulprit: "media", sourceCheckedAt: probe.checkedAt, downSince: probe.downSince, downWhat: "media" });
    expect(d.phase).toMatchObject({ kind: "waiting", cause: "media" });
    expect(d.restart).toBe(false);
  });

  it("au retour : une relance, sauf relance toute fraîche ou lecture finie", () => {
    const now = 200_000;
    expect(restartOnJellyfinReturn({ now, started: true, ended: false, restarting: false, lastRestartAt: null })).toBe(true);
    expect(restartOnJellyfinReturn({ now, started: true, ended: false, restarting: false, lastRestartAt: now - RETURN_RESTART_SKIP_MS + 1 })).toBe(false);
    expect(restartOnJellyfinReturn({ now, started: true, ended: false, restarting: true, lastRestartAt: null })).toBe(false);
    expect(restartOnJellyfinReturn({ now, started: false, ended: false, restarting: false, lastRestartAt: null })).toBe(false);
    expect(restartOnJellyfinReturn({ now, started: true, ended: true, restarting: false, lastRestartAt: null })).toBe(false);
  });
});
