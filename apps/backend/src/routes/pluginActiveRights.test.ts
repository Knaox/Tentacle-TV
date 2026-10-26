/**
 * Une extension ISOLÉE et le droit du compte (`users.rights` → `canUse`) : un
 * compte sans droit ne reçoit RIEN d'elle dans `/api/plugins/active` — ni
 * l'entrée, ni sa navigation (« /music/requests »), ni son contrat `music` — et
 * son bundle lui répond comme à une extension absente. Un compte permis la voit
 * entière ; un administrateur en session personnelle la voit toujours (il la règle).
 */

import Fastify from "fastify";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyRequest } from "fastify";

// Un serveur 1.40.0 : les fonctions d'Octave et des extensions isolées y sont déclarées (declaredCapabilities.ts).
const serverVersion = vi.hoisted(() => ({ value: "1.40.0" }));
vi.mock("../services/version", () => ({
  get BACKEND_VERSION() {
    return serverVersion.value;
  },
}));
vi.mock("../services/dataDir", async () => {
  const { tmpdir } = await import("os");
  const path = await import("path");
  return { DATA_ROOT: path.join(tmpdir(), `tentacle-active-rights-${process.pid}`) };
});
const USERS: Record<string, { userId: string; username: string; isAdmin: boolean; session: string }> = {
  permis: { userId: "u-ok", username: "octave1", isAdmin: false, session: "personal" },
  "sans-droit": { userId: "u-no", username: "octave-sans", isAdmin: false, session: "personal" },
  admin: { userId: "u-admin", username: "admin", isAdmin: true, session: "personal" },
};
vi.mock("../middleware/auth", () => ({
  requireAuth: async (request: FastifyRequest) => {
    (request as FastifyRequest & { user?: unknown }).user = USERS[String(request.headers["x-test-user"])];
  },
  requireAdmin: async () => {},
  requirePersonalAdmin: async () => {},
}));
vi.mock("../plugins/runtime/host/userRights", () => ({
  userRights: vi.fn(async (_pluginId: string, userId: string) => ({ exists: true, isAdmin: false, canUse: userId === "u-ok", canRequest: userId === "u-ok" })),
}));

import { DATA_DIR, getInstalled, saveInstalled } from "../services/pluginManager";
import { repairInstalledConfigDefaults } from "../services/pluginConfigDefaults";
import { forgetIsolatedRights } from "../plugins/runtime/accountRights";
import { pluginRoutes } from "./plugins";
import { resetDeclaredCapabilitiesForTests } from "../serverCapabilities/declaredCapabilities";

const SILLON = {
  id: "sillon", entry: "dist/plugin-sillon.iife.js", storage: { sqlite: true },
  runtime: { kind: "isolated", entry: "server/index.mjs", hostApi: ["users"] },
  music: { search: "/music/search", resolve: "/music/resolve" },
  navItems: [
    { path: "/music/requests", icon: "music", platforms: ["web"], labels: { fr: "Demandes" } },
    { path: "/admin/plugins/sillon", icon: "settings", admin: true, platforms: ["web"] },
  ],
};

async function call(url: string, user: string) {
  const app = Fastify();
  await app.register(pluginRoutes, { prefix: "/api/plugins" });
  const response = await app.inject({ method: "GET", url, headers: { "x-test-user": user } });
  await app.close();
  return response;
}

beforeEach(() => {
  rmSync(DATA_DIR, { recursive: true, force: true });
  const dir = join(DATA_DIR, "sillon");
  mkdirSync(join(dir, "dist"), { recursive: true });
  writeFileSync(join(dir, "plugin.json"), JSON.stringify(SILLON));
  writeFileSync(join(dir, "dist", "plugin-sillon.iife.js"), "/* bundle */");
  saveInstalled([{
    id: "22222222-2222-4222-8222-222222222222", pluginId: "sillon", sourceId: "local", name: "Sillon",
    version: "0.1.0", enabled: true, config: { enabled: true }, installedAt: "2026-10-24T00:00:00.000Z",
  }]);
  forgetIsolatedRights();
});
afterEach(() => {
  rmSync(DATA_DIR, { recursive: true, force: true });
  serverVersion.value = "1.40.0";
  resetDeclaredCapabilitiesForTests();
});

describe("extension isolée et droit du compte", () => {
  it("un compte sans droit : /active sans Sillon, et son bundle n'existe pas", async () => {
    expect((await call("/api/plugins/active", "sans-droit")).json()).toEqual([]);
    expect((await call("/api/plugins/sillon/bundle", "sans-droit")).statusCode).toBe(404);
  });

  it("un compte permis : l'entrée entière, navigation et contrat music compris", async () => {
    const [entry] = (await call("/api/plugins/active", "permis")).json() as Array<Record<string, unknown>>;
    expect(entry).toMatchObject({ pluginId: "sillon", music: { search: "/music/search" } });
    // Sa page d'administration n'est pas pour lui : son entrée ne lui est même pas envoyée.
    expect((entry.navItems as Array<{ path: string }>).map((n) => n.path)).toEqual(["/music/requests"]);
    expect((await call("/api/plugins/sillon/bundle", "permis")).statusCode).toBe(200);
  });

  it("un administrateur en session personnelle la voit toujours (il la règle), entrée d'administration comprise", async () => {
    const entries = (await call("/api/plugins/active", "admin")).json() as Array<{ navItems: Array<{ path: string }> }>;
    expect(entries.length).toBe(1);
    expect(entries[0].navItems.map((n) => n.path)).toEqual(["/music/requests", "/admin/plugins/sillon"]);
  });

  it("extension pas encore configurée : l'administrateur garde son entrée d'administration, un compte permis n'a rien", async () => {
    saveInstalled([{
      id: "22222222-2222-4222-8222-222222222222", pluginId: "sillon", sourceId: "local", name: "Sillon",
      version: "0.1.0", enabled: true, config: {}, installedAt: "2026-10-24T00:00:00.000Z",
    }]);
    const [admin] = (await call("/api/plugins/active", "admin")).json() as Array<{ navItems: Array<{ path: string }> }>;
    expect(admin.navItems.map((n) => n.path)).toEqual(["/admin/plugins/sillon"]);
    const [permis] = (await call("/api/plugins/active", "permis")).json() as Array<{ navItems: unknown[] }>;
    expect(permis.navItems).toEqual([]);
  });

  it("serveur 1.31.4 (sous la version du runtime isolé) : elle n'est servie à personne, administrateur compris", async () => {
    serverVersion.value = "1.31.4";
    resetDeclaredCapabilitiesForTests();
    for (const user of ["permis", "admin"]) {
      expect((await call("/api/plugins/active", user)).json(), user).toEqual([]);
      expect((await call("/api/plugins/sillon/bundle", user)).statusCode, user).toBe(404);
    }
  });

  it("minTentacleVersion plus récente que le serveur : refusée, même sur 1.40.0", async () => {
    writeFileSync(join(DATA_DIR, "sillon", "plugin.json"), JSON.stringify({ ...SILLON, minTentacleVersion: "1.41.0" }));
    expect((await call("/api/plugins/active", "admin")).json()).toEqual([]);
  });
});

describe("installée depuis une source (config vide) : la configuration d'office la rend active", () => {
  it("sans configDefaults, rien n'est publié comme avant ; avec, configEnabled et le contrat musique", async () => {
    saveInstalled(getInstalled().map((p) => ({ ...p, sourceId: "private", config: {} })));
    const [before] = (await call("/api/plugins/active", "admin")).json() as Array<{ configEnabled: boolean }>;
    expect(before?.configEnabled).toBe(false);
    writeFileSync(join(DATA_DIR, "sillon", "plugin.json"), JSON.stringify({ ...SILLON, configDefaults: { enabled: true } }));
    vi.spyOn(console, "log").mockImplementation(() => {});
    expect(repairInstalledConfigDefaults()).toEqual(["sillon"]);
    const [after] = (await call("/api/plugins/active", "permis")).json() as Array<{ configEnabled: boolean; music: unknown }>;
    expect(after).toMatchObject({ configEnabled: true, music: { search: "/music/search" } });
  });
});
