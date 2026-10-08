import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMigrationGate, type MigrationGateDeps } from "./migrationGate";
import { clearDatabaseMigration, readDatabaseMigration, reportDatabaseState, reportMaintenanceResponse } from "./migrationSignal";
import type { HealthSample } from "./migrationPoller";

/**
 * La porte de l'écran d'attente : migration en cours, échec, base prête, serveur
 * d'avant qui ne déclare rien, et une vraie panne qui reste une panne.
 */
const migrating = (percent: number) => ({
  database: { engine: "sqlite", state: "migrating", progress: { done: 3, total: 49, percent, etaSeconds: 42 } },
});
const failed = { database: { engine: "sqlite", state: "failed", reason: "disk_space", retryInSeconds: 30, progress: { percent: 5 } } };
const ready = { status: "ok", database: { engine: "sqlite", state: "ready" } };

function harness(options: { capable: boolean; health: Array<HealthSample | null> }) {
  const health = [...options.health];
  const deps: MigrationGateDeps = {
    refetchConfig: vi.fn(async () => undefined),
    hasCapability: vi.fn(() => options.capable),
    fetchHealth: vi.fn(async () => (health.length > 1 ? health.shift()! : health[0] ?? null)),
    onResume: vi.fn(),
    pollIntervalMs: 2000,
  };
  const gate = createMigrationGate(deps);
  return { gate, deps };
}

const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
  clearDatabaseMigration();
});
afterEach(() => {
  clearDatabaseMigration();
  vi.useRealTimers();
});

describe("porte de l'écran d'attente de la migration", () => {
  it("migration en cours : la configuration est RELUE avant de décider, puis l'écran suit la progression", async () => {
    const { gate, deps } = harness({ capable: true, health: [{ ok: true, body: migrating(40) }] });
    reportDatabaseState(migrating(10));
    expect(gate.read()).toBeNull(); // rien avant la relecture de /api/config
    await flush();
    expect(deps.refetchConfig).toHaveBeenCalledTimes(1);
    expect(gate.read()).toMatchObject({ kind: "migrating", percent: 10 });
    await vi.advanceTimersByTimeAsync(2000);
    expect(gate.read()).toMatchObject({ kind: "migrating", percent: 40 });
    expect(deps.onResume).not.toHaveBeenCalled();
    gate.dispose();
  });

  it("échec : le motif et le prochain essai, toujours l'écran (jamais une panne)", async () => {
    const { gate } = harness({ capable: true, health: [{ ok: true, body: failed }] });
    reportDatabaseState(migrating(10));
    await flush();
    await vi.advanceTimersByTimeAsync(2000);
    expect(gate.read()).toEqual({ kind: "failed", reason: "disk_space", retryInSeconds: 30, percent: 5 });
    gate.dispose();
  });

  it("base prête : l'écran s'efface et la plateforme reprend (requêtes, socket), une seule fois", async () => {
    const { gate, deps } = harness({ capable: true, health: [{ ok: true, body: migrating(90) }, { ok: true, body: ready }] });
    reportDatabaseState(migrating(80));
    await flush();
    await vi.advanceTimersByTimeAsync(4000);
    expect(gate.read()).toBeNull();
    expect(readDatabaseMigration()).toBeNull();
    expect(deps.onResume).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(deps.fetchHealth).toHaveBeenCalledTimes(2); // plus aucune relecture
    gate.dispose();
  });

  it("un serveur qui ne déclare pas la capacité ne montre JAMAIS l'écran, et ne sonde rien", async () => {
    const { gate, deps } = harness({ capable: false, health: [{ ok: true, body: migrating(10) }] });
    reportDatabaseState(migrating(10));
    await flush();
    expect(gate.read()).toBeNull();
    expect(readDatabaseMigration()).toBeNull();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(deps.fetchHealth).not.toHaveBeenCalled();
    gate.dispose();
  });

  it("un serveur d'avant 1.25 ne dit rien de sa base : aucun signe déposé", () => {
    expect(reportDatabaseState({ status: "ok", bootId: "x" })).toBe(false);
    expect(readDatabaseMigration()).toBeNull();
  });

  it("une vraie panne reste une panne : serveur muet → l'écran s'efface, sans reprise", async () => {
    const { gate, deps } = harness({ capable: true, health: [null] });
    reportDatabaseState(migrating(10));
    await flush();
    expect(gate.read()).not.toBeNull();
    await vi.advanceTimersByTimeAsync(2000 * 8);
    expect(gate.read()).toBeNull();
    expect(deps.onResume).not.toHaveBeenCalled();
    gate.dispose();
  });

  it("la courte bascule vers le vrai serveur (quelques secondes muet) ne coupe pas l'écran", async () => {
    const { gate, deps } = harness({ capable: true, health: [null, null, null, { ok: true, body: ready }] });
    reportDatabaseState(migrating(99));
    await flush();
    await vi.advanceTimersByTimeAsync(2000 * 3);
    expect(gate.read()).not.toBeNull();
    await vi.advanceTimersByTimeAsync(2000);
    expect(gate.read()).toBeNull();
    expect(deps.onResume).toHaveBeenCalledTimes(1);
    gate.dispose();
  });
});

describe("signal : le 503 du mode maintenance", () => {
  const response = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

  it("un 503 de maintenance est déposé ; le corps de l'appelant reste lisible", async () => {
    const res = response(503, { state: "migrating", database: migrating(12).database, progress: migrating(12).database.progress });
    expect(await reportMaintenanceResponse(res)).toBe(true);
    expect(readDatabaseMigration()).toMatchObject({ kind: "migrating", percent: 12 });
    expect((await res.json()).state).toBe("migrating");
  });

  it("un 503 sans `database` : sa progression suffit", async () => {
    expect(await reportMaintenanceResponse(response(503, { state: "migrating", progress: { done: 1, total: 4, percent: 25 } }))).toBe(true);
    expect(readDatabaseMigration()).toMatchObject({ kind: "migrating", percent: 25 });
  });

  it("un 503 ordinaire, un 502, un corps illisible : une panne, rien de déposé", async () => {
    expect(await reportMaintenanceResponse(response(503, { message: "Database unavailable" }))).toBe(false);
    expect(await reportMaintenanceResponse(response(502, { state: "migrating" }))).toBe(false);
    expect(await reportMaintenanceResponse(new Response("<html>", { status: 503 }))).toBe(false);
    expect(readDatabaseMigration()).toBeNull();
  });
});
