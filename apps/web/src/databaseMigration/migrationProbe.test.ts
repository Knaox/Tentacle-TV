import { afterEach, describe, expect, it, vi } from "vitest";
import { clearDatabaseMigration, readDatabaseMigration } from "@tentacle-tv/api-client";

/**
 * La sonde de connectivité du web et du bureau face à la migration de la base :
 * le serveur répond, ce n'est PAS une panne (ni voile, ni hors ligne). Une
 * vraie panne reste une panne ; un serveur d'avant ne dépose rien.
 */
vi.mock("../main", () => ({ backendUrl: "" }));
vi.mock("../hooks/mpvRuntime", () => ({ isTauri: () => false }));

const { probeReachability } = await import("../offline/connectivityStore");

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

function serve(health: Response, jellyfin: () => Response) {
  const calls: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    calls.push(url);
    return url.endsWith("/api/health") ? health : jellyfin();
  }));
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  clearDatabaseMigration();
});

describe("sonde web/bureau pendant la migration de la base", () => {
  it("migration en cours : joignable, le proxy Jellyfin (fermé) n'est pas sondé, le signe est déposé", async () => {
    const calls = serve(json(200, { status: "ok", database: { engine: "sqlite", state: "migrating", progress: { percent: 30 } } }), () => json(503, { state: "migrating" }));
    expect(await probeReachability()).toBe("ok");
    expect(calls).toEqual(["/api/health"]);
    expect(readDatabaseMigration()).toMatchObject({ kind: "migrating", percent: 30 });
  });

  it("migration en échec : toujours joignable", async () => {
    serve(json(200, { status: "ok", database: { state: "failed", reason: "copy_failed", retryInSeconds: 20 } }), () => json(503, {}));
    expect(await probeReachability()).toBe("ok");
    expect(readDatabaseMigration()).toMatchObject({ kind: "failed", reason: "copy_failed" });
  });

  it("base prête, ou serveur 1.24 sans `database` : la sonde ordinaire, Jellyfin compris, rien de déposé", async () => {
    const calls = serve(json(200, { status: "ok", bootId: "x" }), () => json(200, { Id: "jf" }));
    expect(await probeReachability()).toBe("ok");
    expect(calls).toEqual(["/api/health", "/api/jellyfin/System/Info/Public"]);
    expect(readDatabaseMigration()).toBeNull();
  });

  it("une vraie panne reste une panne : serveur muet ou 502", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    expect(await probeReachability()).toBe("backend");
    serve(json(502, {}), () => json(200, {}));
    expect(await probeReachability()).toBe("backend");
    expect(readDatabaseMigration()).toBeNull();
  });
});
