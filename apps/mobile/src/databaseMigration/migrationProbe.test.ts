import { afterEach, describe, expect, it, vi } from "vitest";
import { clearDatabaseMigration, readDatabaseMigration } from "@tentacle-tv/api-client";
import { runProbe } from "../offline/connectivityProbe";

/**
 * La sonde du mode hors ligne automatique face à la migration de la base : le
 * serveur répond, ce n'est PAS une panne — ni bascule hors ligne, ni message de
 * connectivité. Une vraie panne reste une panne ; un serveur d'avant ne dépose rien.
 */
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

function serve(health: () => Response, jellyfin: () => Response) {
  const calls: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    calls.push(url);
    return url.endsWith("/api/health") ? health() : jellyfin();
  }));
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  clearDatabaseMigration();
});

describe("sonde mobile pendant la migration de la base", () => {
  it("migration en cours : en ligne, sans sonder le proxy Jellyfin fermé", async () => {
    const calls = serve(() => json(200, { status: "ok", database: { state: "migrating", progress: { done: 1, total: 49, percent: 2 } } }), () => json(503, { state: "migrating" }));
    expect(await runProbe("http://srv")).toMatchObject({ ok: true, reason: null });
    expect(calls).toEqual(["http://srv/api/health"]);
    expect(readDatabaseMigration()).toMatchObject({ kind: "migrating", percent: 2 });
  });

  it("migration en échec : toujours en ligne", async () => {
    serve(() => json(200, { status: "ok", database: { state: "failed", reason: "source_too_old", retryInSeconds: 60 } }), () => json(503, {}));
    expect(await runProbe("http://srv")).toMatchObject({ ok: true });
    expect(readDatabaseMigration()).toMatchObject({ kind: "failed", reason: "source_too_old" });
  });

  it("ancienne base absente (`source_missing`) : joignable, motif sans prochain essai", async () => {
    serve(() => json(200, { status: "ok", database: { state: "failed", reason: "source_missing" } }), () => json(503, {}));
    expect(await runProbe("http://srv")).toMatchObject({ ok: true });
    expect(readDatabaseMigration()).toEqual({ kind: "failed", reason: "source_missing", retryInSeconds: null, percent: 0 });
  });

  it("base prête, ou serveur 1.24 sans `database` : la sonde ordinaire, Jellyfin compris", async () => {
    const calls = serve(() => json(200, { status: "ok" }), () => json(200, { Id: "jf" }));
    expect(await runProbe("http://srv")).toMatchObject({ ok: true });
    expect(calls).toHaveLength(2);
    expect(readDatabaseMigration()).toBeNull();
  });

  it("une vraie panne reste une panne", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Network request failed"); }));
    expect(await runProbe("http://srv")).toMatchObject({ ok: false, reason: "backend" });
    serve(() => json(502, {}), () => json(200, {}));
    expect(await runProbe("http://srv")).toMatchObject({ ok: false, reason: "backend" });
    expect(readDatabaseMigration()).toBeNull();
  });
});
