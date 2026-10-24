/**
 * Les dépendances partagées des pages d'extension (`/api/plugins/shared-deps.js`,
 * `/api/plugins/tailwind.js`). Vécu le 24/10 : un serveur lancé depuis les
 * sources avec son propre `TENTACLE_DATA_DIR` répondait 404, et la page
 * d'administration de Sillon disait « serveur trop ancien » — Lidarr ne se
 * réglait plus. Le dossier de données d'abord, puis la sortie du build ; hors
 * production le build se lance une fois ; sinon une erreur du SERVEUR (500),
 * jamais un 404.
 */

import Fastify from "fastify";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ROOT = join(tmpdir(), `tentacle-shared-deps-${process.pid}`);
const DATA_ROOT = join(ROOT, "data");
const BUILD_DIR = join(ROOT, "package", "data", "shared-deps");

const build = vi.hoisted(() => ({ allowed: true, run: async () => {} }));

vi.mock("../services/dataDir", async () => {
  const { tmpdir: tmp } = await import("os");
  const path = await import("path");
  return { DATA_ROOT: path.join(tmp(), `tentacle-shared-deps-${process.pid}`, "data") };
});
vi.mock("../services/pluginSharedDeps/sharedDepsBuild", async () => {
  const { tmpdir: tmp } = await import("os");
  const path = await import("path");
  return {
    SHARED_DEPS_BUILD_DIR: path.join(tmp(), `tentacle-shared-deps-${process.pid}`, "package", "data", "shared-deps"),
    mayBuildSharedDeps: () => build.allowed,
    buildSharedDeps: () => build.run(),
  };
});
vi.mock("../middleware/auth", () => ({
  requireAuth: async () => {},
  requireAdmin: async () => {},
  requirePersonalAdmin: async () => {},
}));

function put(dir: string, name: string, content: string) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), content);
}

async function get(url: string) {
  vi.resetModules();
  const { pluginRoutes } = await import("./plugins");
  const app = Fastify();
  await app.register(pluginRoutes, { prefix: "/api/plugins" });
  const response = await app.inject({ method: "GET", url });
  await app.close();
  return response;
}

beforeEach(() => {
  rmSync(ROOT, { recursive: true, force: true });
  mkdirSync(join(DATA_ROOT, "plugins"), { recursive: true });
  build.allowed = true;
  build.run = async () => {};
});
afterEach(() => rmSync(ROOT, { recursive: true, force: true }));

describe("dépendances partagées des pages d'extension", () => {
  it("absentes du dossier de données : la sortie du build les sert", async () => {
    put(BUILD_DIR, "shared-deps.js", "window.__SHARED_DEPS__ = 1;");
    put(BUILD_DIR, "tailwind.js", "/* tailwind */");
    const deps = await get("/api/plugins/shared-deps.js");
    expect(deps.statusCode).toBe(200);
    expect(deps.body).toBe("window.__SHARED_DEPS__ = 1;");
    expect((await get("/api/plugins/tailwind.js")).statusCode).toBe(200);
  });

  it("la semence du dossier de données passe avant la sortie du build", async () => {
    put(join(DATA_ROOT, "shared-deps"), "shared-deps.js", "/* semence */");
    put(BUILD_DIR, "shared-deps.js", "/* build */");
    expect((await get("/api/plugins/shared-deps.js")).body).toBe("/* semence */");
  });

  it("nulle part, hors production : le build se lance une fois puis sert", async () => {
    let runs = 0;
    build.run = async () => {
      runs++;
      put(BUILD_DIR, "shared-deps.js", "/* construit */");
    };
    const deps = await get("/api/plugins/shared-deps.js");
    expect(deps.statusCode).toBe(200);
    expect(deps.body).toBe("/* construit */");
    expect(runs).toBe(1);
  });

  it("nulle part et sans build possible : une erreur du serveur, jamais un 404", async () => {
    build.allowed = false;
    const deps = await get("/api/plugins/shared-deps.js");
    expect(deps.statusCode).toBe(500);
    expect(deps.json()).toMatchObject({ message: expect.stringContaining("build:shared-deps") });
    expect((await get("/api/plugins/tailwind.js")).statusCode).toBe(500);
  });

  it("un build qui échoue : erreur du serveur, et la demande suivante le retente", async () => {
    let runs = 0;
    build.run = async () => { runs++; throw new Error("réseau coupé"); };
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect((await get("/api/plugins/shared-deps.js")).statusCode).toBe(500);
    expect((await get("/api/plugins/shared-deps.js")).statusCode).toBe(500);
    expect(runs).toBe(2);
  });
});
