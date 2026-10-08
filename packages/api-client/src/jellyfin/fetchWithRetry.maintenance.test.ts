import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithRetry } from "./fetchWithRetry";
import { clearDatabaseMigration, readDatabaseMigration } from "../databaseMigration/migrationSignal";
import { JellyfinClient } from "../jellyfin";
import type { StorageAdapter } from "../storage";

/**
 * Le signal « base du serveur en migration » ne vient QUE du serveur Tentacle
 * (son proxy `…/api/jellyfin`) : un Jellyfin joint en direct qui rendrait un
 * 503 « migrating » (hôte hostile, intermédiaire sur un réseau en HTTP) ne
 * dépose rien — et reste une erreur ordinaire, retentée.
 */
const maintenance = () =>
  new Response(JSON.stringify({ state: "migrating", database: { state: "migrating", progress: { percent: 30 } } }), { status: 503 });

const call = (baseUrl: string, tentacleProxy: boolean) =>
  fetchWithRetry(
    { baseUrl, path: "/Items", init: { method: "POST" }, accessToken: null, useCredentials: false, authHeader: "x", tentacleProxy },
    { consecutive401Count: 0, authRefreshInProgress: false },
  ).catch((e: unknown) => e);

afterEach(() => {
  vi.unstubAllGlobals();
  clearDatabaseMigration();
});

describe("fetchWithRetry et le 503 du mode maintenance", () => {
  it("par le proxy du serveur Tentacle : le signe est déposé, sans dérouler l'échelle de reprises", async () => {
    const fetchMock = vi.fn(async () => maintenance());
    vi.stubGlobal("fetch", fetchMock);
    await call("http://srv/api/jellyfin", true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(readDatabaseMigration()).toMatchObject({ kind: "migrating", percent: 30 });
  });

  it("d'un Jellyfin joint en direct : rien n'est déposé, l'erreur reste ordinaire", async () => {
    const fetchMock = vi.fn(async () => maintenance());
    vi.stubGlobal("fetch", fetchMock);
    await call("http://jellyfin.lan:8096", false);
    expect(fetchMock).toHaveBeenCalledTimes(2); // une mutation : une seule reprise, comme tout 503
    expect(readDatabaseMigration()).toBeNull();
  });

  it("le client Jellyfin ne s'en remet au signe que par le proxy de Tentacle", async () => {
    const memory = new Map<string, string>();
    const storage = {
      getItem: (k: string) => memory.get(k) ?? null,
      setItem: (k: string, v: string) => void memory.set(k, v),
      removeItem: (k: string) => void memory.delete(k),
    } as unknown as StorageAdapter;
    const uuid = { randomUUID: () => "appareil" };
    vi.stubGlobal("fetch", vi.fn(async () => maintenance()));

    await new JellyfinClient("http://jellyfin.lan:8096", storage, uuid).fetch("/Items", { method: "POST" }).catch(() => undefined);
    expect(readDatabaseMigration()).toBeNull();

    await new JellyfinClient("/api/jellyfin", storage, uuid).fetch("/Items", { method: "POST" }).catch(() => undefined);
    expect(readDatabaseMigration()).toMatchObject({ kind: "migrating" });
  });
});
