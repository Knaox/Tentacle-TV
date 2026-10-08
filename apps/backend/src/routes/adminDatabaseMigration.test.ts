import { beforeEach, describe, expect, it, vi } from "vitest";
import Fastify from "fastify";

const m = vi.hoisted(() => ({ session: "personal", url: "mysql://u:p@db/tentacle" as string | null, remigrate: vi.fn() }));
vi.mock("../middleware/auth", () => ({
  requirePersonalAdmin: async (_req: unknown, reply: { status(n: number): { send(b: unknown): unknown } }) => {
    if (m.session !== "personal") return reply.status(403).send({ message: "Forbidden" });
  },
}));
vi.mock("../services/database/legacySource", () => ({ legacyMariadbUrl: () => m.url }));
vi.mock("../dbMigration/postMigration", () => ({ requestRemigration: m.remigrate }));
vi.mock("../dbMigration/admin/migrationSummary", () => ({
  databaseMigrationSummary: async () => ({ legacy: "migrated", sourceConfigured: true, cache: { phase: "running", percent: 42 } }),
}));

import { adminDatabaseMigrationRoutes } from "./adminDatabaseMigration";

async function call(method: "GET" | "POST", url: string) {
  const app = Fastify();
  await app.register(adminDatabaseMigrationRoutes, { prefix: "/api/admin" });
  const res = await app.inject({ method, url });
  await app.close();
  return res;
}

describe("administration : la migration de la base", () => {
  beforeEach(() => {
    m.session = "personal";
    m.url = "mysql://u:p@db/tentacle";
    m.remigrate.mockReset();
  });

  it("GET /database/migration : le résumé", async () => {
    const res = await call("GET", "/api/admin/database/migration");
    expect(res.json()).toMatchObject({ legacy: "migrated", cache: { percent: 42 } });
  });

  it("POST /database/remigrate : session personnelle seulement, puis redémarrage contrôlé", async () => {
    m.session = "tvLegacy";
    expect((await call("POST", "/api/admin/database/remigrate")).statusCode).toBe(403);
    expect(m.remigrate).not.toHaveBeenCalled();
    m.session = "personal";
    const res = await call("POST", "/api/admin/database/remigrate");
    expect(res.json()).toEqual({ restarting: true });
    expect(m.remigrate).toHaveBeenCalledTimes(1);
  });

  it("sans ancienne base configurée : refusé (409), rien n'est fait", async () => {
    m.url = null;
    const res = await call("POST", "/api/admin/database/remigrate");
    expect(res.statusCode).toBe(409);
    expect(m.remigrate).not.toHaveBeenCalled();
  });
});
