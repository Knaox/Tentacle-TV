/**
 * La navigation réglée par une extension (capacité `plugins.navigation`) dans
 * `/api/plugins/active` : une extension qui ne la déclare pas — ou un invité
 * absent — donne exactement la liste d'avant, sans un appel ; une extension qui
 * la déclare voit son nom et sa place fusionnés dans ses pages, jamais dans son
 * entrée d'administration ; une page qu'elle masque reste dans la liste (les
 * clients en gardent la route), marquée `hidden`.
 */

import Fastify from "fastify";
import { createServer, type Server } from "http";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FastifyRequest } from "fastify";

// Un serveur 1.40.0 : les fonctions d'Octave et des extensions isolées y sont déclarées (declaredCapabilities.ts).
const serverVersion = vi.hoisted(() => ({ value: "1.40.0" }));
vi.mock("../services/version", () => ({
  get BACKEND_VERSION() {
    return serverVersion.value;
  },
}));
vi.mock("../services/dataDir", async () => {
  const { tmpdir: tmp } = await import("os");
  const path = await import("path");
  return { DATA_ROOT: path.join(tmp(), `tentacle-active-nav-${process.pid}`) };
});
vi.mock("../middleware/auth", () => ({
  requireAuth: async (request: FastifyRequest) => {
    (request as FastifyRequest & { user?: unknown }).user = { userId: "u-admin", username: "admin", isAdmin: true, session: "personal" };
  },
  requireAdmin: async () => {},
  requirePersonalAdmin: async () => {},
}));
vi.mock("../plugins/runtime/host/userRights", () => ({
  userRights: vi.fn(async () => ({ exists: true, isAdmin: true, canUse: true, canRequest: true })),
}));

import { DATA_DIR, saveInstalled } from "../services/pluginManager";
import { configureNavigationLookup } from "../plugins/runtime/navigation/navigationRuntime";
import { pluginRoutes } from "./plugins";

const PAGE = { path: "/x/page", icon: "clock", platforms: ["web"], labels: { fr: "Extension", en: "Extension" } };
const ADMIN = { path: "/admin/plugins/x", icon: "settings", admin: true, platforms: ["web"], labels: { fr: "X" } };

function install(pluginId: string, manifest: Record<string, unknown>, enabled = true) {
  rmSync(DATA_DIR, { recursive: true, force: true });
  const dir = join(DATA_DIR, pluginId);
  mkdirSync(join(dir, "dist"), { recursive: true });
  writeFileSync(join(dir, "plugin.json"), JSON.stringify({
    id: pluginId, entry: `dist/plugin-${pluginId}.iife.js`, storage: { sqlite: true },
    runtime: { kind: "isolated", entry: "server/index.mjs", hostApi: ["users"] },
    navItems: [PAGE, ADMIN], ...manifest,
  }));
  saveInstalled([{
    id: "33333333-3333-4333-8333-333333333333", pluginId, sourceId: "local", name: pluginId,
    version: "0.1.0", enabled: true, config: { enabled }, installedAt: "2026-10-25T00:00:00.000Z",
  }]);
}

let guest: Server | null = null;
let folder: string | null = null;

async function startGuest(body: unknown): Promise<string> {
  folder = mkdtempSync(join(tmpdir(), "nav-guest-"));
  const socket = join(folder, "g.sock");
  guest = createServer((_req, res) => { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(body)); });
  await new Promise<void>((done) => guest!.listen(socket, done));
  return socket;
}

async function active(): Promise<Array<Record<string, unknown>>> {
  const app = Fastify();
  await app.register(pluginRoutes, { prefix: "/api/plugins" });
  const response = await app.inject({ method: "GET", url: "/api/plugins/active" });
  await app.close();
  return response.json() as Array<Record<string, unknown>>;
}

afterEach(async () => {
  configureNavigationLookup(null);
  await new Promise<void>((done) => (guest ? guest.close(() => done()) : done()));
  guest = null;
  if (folder) rmSync(folder, { recursive: true, force: true });
  rmSync(DATA_DIR, { recursive: true, force: true });
});

describe("navigation d'extension dans /api/plugins/active", () => {
  it("extension qui ne déclare rien : la liste d'avant, et l'invité n'est pas appelé", async () => {
    install("ext-avant", {});
    const socketOf = vi.fn(async () => null);
    configureNavigationLookup({ socketOf, locale: () => "fr" });
    const [entry] = await active();
    expect(entry.navItems).toEqual([PAGE, ADMIN]);
    expect(entry).not.toHaveProperty("navigation");
    expect(socketOf).not.toHaveBeenCalled();
  });

  it("extension qui déclare : nom choisi et place fusionnés, l'administration intacte", async () => {
    install("ext-nav", { navigation: "/navigation" });
    const socket = await startGuest({ items: [{ path: "/x/page", label: "Mes sons", primary: false }] });
    configureNavigationLookup({ socketOf: async () => socket, locale: () => "fr" });
    const [entry] = await active();
    expect(entry.navigation).toBe("/navigation");
    expect(entry.navItems).toEqual([
      { path: "/x/page", icon: "clock", platforms: ["web"], label: "Mes sons", primary: false },
      ADMIN,
    ]);
  });

  it("page masquée : toujours dans navItems (sa route reste), marquée `hidden`, jamais `primary`", async () => {
    install("ext-masquee", { navigation: "/navigation" });
    const socket = await startGuest({ items: [{ path: "/x/page", label: null, primary: false, hidden: true }] });
    configureNavigationLookup({ socketOf: async () => socket, locale: () => "fr" });
    const [entry] = await active();
    expect(entry.navItems).toStrictEqual([{ ...PAGE, primary: false, hidden: true }, ADMIN]);
  });

  it("invité absent : la liste d'avant, sans erreur", async () => {
    install("ext-muet", { navigation: "/navigation" });
    configureNavigationLookup({ socketOf: async () => null, locale: () => "fr" });
    const [entry] = await active();
    expect(entry.navItems).toEqual([PAGE, ADMIN]);
  });

  it("intégration éteinte : aucune page, aucun appel à l'invité", async () => {
    install("ext-eteinte", { navigation: "/navigation" }, false);
    const socketOf = vi.fn(async () => null);
    configureNavigationLookup({ socketOf, locale: () => "fr" });
    const [entry] = await active();
    expect(entry.navItems).toEqual([ADMIN]);
    expect(entry).not.toHaveProperty("navigation");
    expect(socketOf).not.toHaveBeenCalled();
  });
});
