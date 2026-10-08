import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildMaintenanceServer } from "./maintenanceServer";
import { maintenanceConfigBody, maintenanceHealthBody } from "./maintenanceBodies";
import { migrationFailed, migrationFinished, migrationProgressed, migrationStarted } from "../migrationState";

/**
 * Le serveur de maintenance FERME tout ce qui n'est pas l'état public : aucune
 * route d'assistant (le voisin du réseau local non plus, audit S3), aucune
 * socket, aucune extension ; `/api/health` et `/api/config` répondent sans base.
 */
let app: FastifyInstance;
beforeAll(async () => {
  migrationStarted(Date.now() - 5000);
  migrationProgressed({ tablesDone: 3, tablesTotal: 49, bytesDone: 10, bytesTotal: 100 });
  app = await buildMaintenanceServer({ port: 0, host: "127.0.0.1", healthBody: maintenanceHealthBody, configBody: maintenanceConfigBody });
});
afterAll(async () => {
  await app.close();
  migrationFinished();
});

const call = (method: "GET" | "POST", url: string, headers: Record<string, string> = {}) =>
  app.inject({ method, url, headers, ...(method === "POST" ? { payload: {} } : {}) });

describe("mode maintenance : l'assistant d'installation reste FERMÉ (audit S3)", () => {
  it.each([
    ["POST", "/api/setup/session/local"],
    ["POST", "/api/setup/session"],
    ["GET", "/api/setup/host"],
    ["GET", "/api/setup/context"],
    ["POST", "/api/setup/jellyfin/probe"],
    ["GET", "/api/setup/jellyfin/discover"],
    ["POST", "/api/setup/complete"],
  ] as const)("%s %s → 503 « migrating »", async (method, url) => {
    const res = await call(method, url);
    expect(res.statusCode).toBe(503);
    expect(res.json().state).toBe("migrating");
  });

  it("GET /api/setup/status répond 503 et ne dit jamais « ouvert » (un 200 non running enverrait un client livré dans l'assistant)", async () => {
    const res = await call("GET", "/api/setup/status");
    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ state: "migrating", setupOpen: false });
  });
});

describe("mode maintenance : ni socket, ni extension, ni route du cœur (S5b)", () => {
  it.each([
    ["GET", "/api/ws"],
    ["GET", "/api/plugins/active"],
    ["POST", "/api/plugins/seer/requests"],
    ["GET", "/api/plugins/seer/anything"],
    ["POST", "/api/auth/login"],
    ["GET", "/api/jellyfin/Users/Me"],
    ["GET", "/api/admin/database"],
  ] as const)("%s %s → 503", async (method, url) => {
    const res = await call(method, url, url === "/api/ws" ? { connection: "upgrade", upgrade: "websocket" } : {});
    expect(res.statusCode).toBe(503);
    expect(res.headers["retry-after"]).toBe("5");
    expect(res.json()).toMatchObject({ state: "migrating", progress: { done: 3, total: 49, percent: 10 } });
  });

  it("rien au journal, pas même une URL d'ancien client portant un jeton : GET, POST hors /api, erreur", async () => {
    const written: string[] = [];
    const capture = (chunk: unknown) => {
      written.push(String(chunk));
      return true;
    };
    const out = vi.spyOn(process.stdout, "write").mockImplementation(capture);
    const err = vi.spyOn(process.stderr, "write").mockImplementation(capture);
    try {
      await call("GET", "/videos/abc/hls1/main/0.ts?api_key=jeton-secret-de-test");
      await call("POST", "/hors-api?api_key=jeton-secret-de-test");
      await app.inject({ method: "GET", url: "/api/health?api_key=jeton-secret-de-test", headers: { "content-type": "application/json" }, payload: "{non json" });
    } finally {
      out.mockRestore();
      err.mockRestore();
    }
    expect(written.join("")).not.toMatch(/jeton-secret-de-test|api_key|hors-api|hls1/);
  });

  it("/api/health : 200, l'état de la base en nombres", async () => {
    const res = await call("GET", "/api/health");
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe("ok");
    expect(body.database).toMatchObject({ engine: "sqlite", state: "migrating", progress: { done: 3, total: 49, percent: 10 } });
    expect(body.pluginBackends).toEqual({ loadResults: [] });
  });

  it("/api/config : 200 sans base, avec la capacité de l'écran d'attente", async () => {
    const res = await call("GET", "/api/config");
    expect(res.statusCode).toBe(200);
    expect(res.json().capabilities).toContain("server.databaseMigration");
    expect(res.json().publicUrl).toBeNull();
  });
});

describe("état public d'un échec : rien hors de la liste fermée", () => {
  it("motif et prochain essai, aucun texte libre", async () => {
    migrationFailed("source_unreachable", Date.now() + 30_000);
    const db = (await call("GET", "/api/health")).json().database;
    expect(Object.keys(db).sort()).toEqual(["engine", "progress", "reason", "retryInSeconds", "state"]);
    expect(db).toMatchObject({ engine: "sqlite", state: "failed", reason: "source_unreachable" });
    expect(db.retryInSeconds).toBeGreaterThan(25);
    expect(Object.values(db.progress).every((v) => typeof v === "number" || v === null)).toBe(true);
  });
});

describe("la page d'attente minimale (toute navigation, même interface web coupée)", () => {
  it.each(["/", "/tv/", "/library/123", "/admin"])("GET %s → la page d'attente, et rien de l'interface normale", async (url) => {
    const previous = process.env.TENTACLE_WEB_UI;
    process.env.TENTACLE_WEB_UI = "off";
    try {
      const res = await app.inject({ method: "GET", url, headers: { "accept-language": "fr-FR,fr;q=0.9" } });
      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toMatch(/text\/html/);
      expect(res.headers["cache-control"]).toBe("no-store");
      expect(res.body).toContain("Migration de la base de données en cours");
      // Aucune ressource de l'application, aucun script externe : une page autonome.
      expect(res.body).not.toMatch(/<script[^>]+src=|<link[^>]+href=/);
      expect(res.body).toContain("/api/health");
    } finally {
      if (previous === undefined) delete process.env.TENTACLE_WEB_UI;
      else process.env.TENTACLE_WEB_UI = previous;
    }
  });

  it("en anglais pour un navigateur qui ne demande pas le français", async () => {
    const res = await app.inject({ method: "GET", url: "/", headers: { "accept-language": "en-US,en" } });
    expect(res.body).toContain("Database migration in progress");
    expect(res.body).toContain('lang="en"');
  });
});
