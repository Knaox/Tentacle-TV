import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildMaintenanceServer } from "../dbMigration/maintenance/maintenanceServer";
import { maintenanceConfigBody, maintenanceHealthBody } from "../dbMigration/maintenance/maintenanceBodies";
import { migrationFinished, migrationProgressed, migrationStarted } from "../dbMigration/migrationState";

/**
 * La SURFACE du serveur de maintenance (audit du chantier SQLite, S2/S3/S5) :
 * pendant la migration, il n'existe que l'état public, une réponse 503 pour
 * tout le reste de l'API, et la page d'attente. Sa table de routes est FERMÉE :
 * une route de plus — une porte ouverte sans base, sans garde du cœur — fait
 * échouer ce test. Et toute porte sensible du serveur normal y répond 503,
 * quelle que soit la méthode.
 */
let app: FastifyInstance;

beforeAll(async () => {
  migrationStarted(Date.now() - 5_000);
  migrationProgressed({ tablesDone: 1, tablesTotal: 10, bytesDone: 1, bytesTotal: 10 });
  app = await buildMaintenanceServer({
    port: 0, host: "127.0.0.1", healthBody: maintenanceHealthBody, configBody: maintenanceConfigBody,
  });
  await app.ready();
});

afterAll(async () => {
  await app.close();
  migrationFinished();
});

/**
 * Les routes déclarées, en « MÉTHODE chemin », triées — relues dans l'arbre de
 * `printRoutes()` (chaque nœud n'y porte que son segment : le chemin entier se
 * recompose depuis la racine, jokers compris).
 */
function declaredRoutes(): string[] {
  const routes = new Set<string>();
  const stack: string[] = [];
  for (const line of app.printRoutes().split("\n")) {
    const node = /^((?:[│ ] {3})*)[├└]── (.*)$/.exec(line);
    if (!node) continue;
    const depth = node[1].length / 4;
    const [, segment, methods] = /^(.*?)(?: \(([A-Z, ]+)\))?$/.exec(node[2]) ?? [];
    stack[depth] = segment === "(empty root node)" ? "" : segment;
    stack.length = depth + 1;
    if (methods) for (const method of methods.split(", ")) routes.add(`${method} ${stack.join("")}`);
  }
  return [...routes].sort();
}

describe("serveur de maintenance — une surface fermée", () => {
  it("n'a que l'état public, la réponse « en migration » et la page d'attente", () => {
    const allowed = new Set([
      "GET /api/health", "HEAD /api/health",
      "GET /api/config", "HEAD /api/config",
      "GET /api/setup/status", "HEAD /api/setup/status",
      ...["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"].map((method) => `${method} /api/*`),
      "GET /*", "HEAD /*",
      // Le contrôle préalable CORS d'un navigateur.
      "OPTIONS *",
    ]);
    const routes = declaredRoutes();
    // L'arbre a bien été relu : les portes attendues y sont, jokers compris.
    expect(routes).toEqual(expect.arrayContaining(["GET /api/health", "POST /api/*", "GET /*"]));
    expect(routes.filter((route) => !allowed.has(route))).toEqual([]);
  });

  it.each([
    ["POST", "/api/auth/login"],
    ["POST", "/api/pair/claim"],
    ["POST", "/api/family/tv/enroll"],
    ["GET", "/api/admin/services"],
    ["PUT", "/api/admin/database"],
    ["POST", "/api/setup/session/local"],
    ["GET", "/api/ws"],
    ["GET", "/api/plugins/active"],
    ["GET", "/api/plugins/seer/bundle"],
    ["DELETE", "/api/plugins/installed/x"],
  ] as const)("%s %s → 503, sans rien servir", async (method, url) => {
    const res = await app.inject({ method, url, ...(method === "GET" || method === "DELETE" ? {} : { payload: {} }) });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ state: "migrating" });
  });

  it("une page hors de l'API ne reçoit que la page d'attente, jamais en cache", async () => {
    const res = await app.inject({ method: "GET", url: "/admin/services?x=<script>" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.body).not.toContain("<script>alert");
    expect(res.body).not.toContain("x=<script>");
  });
});
