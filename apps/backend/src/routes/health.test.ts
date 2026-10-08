import { beforeEach, describe, expect, it, vi } from "vitest";
import Fastify from "fastify";

const validateToken = vi.fn();
vi.mock("../middleware/auth", () => ({
  getTokenFromRequest: (request: { headers: Record<string, string> }) => request.headers.authorization?.slice(7) ?? null,
  validateToken: (token: string) => validateToken(token),
}));
vi.mock("../services/pluginBackendLoader", () => ({
  pluginBackendDiag: {
    dataDir: "/app/apps/backend/data",
    enabledPlugins: ["seer", "autre"],
    loadResults: [
      { pluginId: "seer", status: "loaded" },
      { pluginId: "autre", status: "error", detail: "Error: at /app/apps/backend/data/plugins/autre/server.js:12" },
    ],
  },
}));
vi.mock("../services/jellyfinHealth", () => ({ jellyfinHealth: () => ({ state: "up" }) }));

import { healthRoutes } from "./health";
import { migrationFinished, migrationStarted, migrationProgressed } from "../dbMigration/migrationState";

async function health(headers: Record<string, string> = {}) {
  const app = Fastify();
  await app.register(healthRoutes, { prefix: "/api" });
  const res = await app.inject({ method: "GET", url: "/api/health", headers });
  await app.close();
  return res.json();
}

describe("GET /api/health — public, additif", () => {
  beforeEach(() => {
    validateToken.mockReset();
    migrationFinished();
  });

  it("ni dossier de données ni liste des extensions ; le détail d'un échec reste caché sans authentification", async () => {
    const body = await health();
    expect(body.pluginBackends).toEqual({
      loadResults: [
        { pluginId: "seer", status: "loaded" },
        { pluginId: "autre", status: "error" },
      ],
    });
    expect(JSON.stringify(body)).not.toContain("/app/apps/backend/data");
    expect(body.status).toBe("ok");
    expect(typeof body.bootId).toBe("string");
  });

  it("un administrateur authentifié voit le détail (suivi de redémarrage des extensions)", async () => {
    validateToken.mockResolvedValue({ ok: true, user: { isAdmin: true } });
    const body = await health({ authorization: "Bearer jeton-admin" });
    expect(body.pluginBackends.loadResults[1].detail).toContain("server.js");
  });

  it("un compte non administrateur ne le voit pas", async () => {
    validateToken.mockResolvedValue({ ok: true, user: { isAdmin: false } });
    const body = await health({ authorization: "Bearer jeton" });
    expect(body.pluginBackends.loadResults[1].detail).toBeUndefined();
  });

  it("database : { engine, state } au repos, une progression en nombres pendant la migration", async () => {
    expect((await health()).database).toEqual({ engine: "sqlite", state: "ready" });
    migrationStarted(Date.now() - 10_000);
    migrationProgressed({ tablesDone: 10, tablesTotal: 40, bytesDone: 50, bytesTotal: 100 });
    const db = (await health()).database;
    expect(db).toMatchObject({ engine: "sqlite", state: "migrating", progress: { done: 10, total: 40, percent: 50 } });
    expect(db.progress.etaSeconds).toBeGreaterThan(0);
    expect(Object.keys(db).sort()).toEqual(["engine", "progress", "state"]);
  });
});
