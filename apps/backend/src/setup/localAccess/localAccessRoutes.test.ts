import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";
import { existsSync, rmSync } from "fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => {
  delete process.env.TENTACLE_DEPLOYMENT;
  return { config: new Map<string, string>() };
});
vi.mock("../../services/dataDir", async () => {
  const { mkdtempSync } = await import("fs");
  const { tmpdir } = await import("os");
  const { join } = await import("path");
  return { DATA_ROOT: mkdtempSync(join(tmpdir(), "wiz-local-")) };
});
vi.mock("../../services/configStore", () => ({
  getConfigValue: (key: string) => state.config.get(key),
  setConfigValue: async (key: string, value: string) => void state.config.set(key, value),
  deleteConfigValue: async (key: string) => void state.config.delete(key),
  detectAppState: async () => "setup_jellyfin",
  getAppState: () => "setup_jellyfin",
  setAppState: () => undefined,
  isSetupComplete: () => false,
}));
vi.mock("../../services/db", () => ({
  hasPrisma: () => false,
  hasDatabaseUrl: () => true,
  getDatabaseUrlSource: () => "env",
  reconnectPrisma: async () => false,
}));

import { DATA_ROOT } from "../../services/dataDir";
import { isTrustedProxy } from "../../services/trustedProxies";
import { bootSetup } from "../setupRuntime";
import { sealSetup } from "../setupLock";
import { readSetupToken } from "../setupToken";
import { setupWizardRoutes } from "../setupWizardRoutes";
import { SETUP_CLAIMANT_FILE } from "./claimant";

let app: FastifyInstance;

beforeAll(async () => {
  // Comme le serveur : les mandataires voisins seuls sont crus.
  app = Fastify({ trustProxy: (address: string) => isTrustedProxy(address) });
  await app.register(rateLimit, { max: 1000, timeWindow: "1 minute" });
  await app.register(setupWizardRoutes, { prefix: "/api/setup" });
  bootSetup(3000);
});
afterAll(async () => {
  await app.close();
  rmSync(DATA_ROOT, { recursive: true, force: true });
});

interface Caller {
  ip: string;
  host?: string;
  headers?: Record<string, string>;
  session?: string;
}

function call(method: "GET" | "POST", url: string, who: Caller, body?: Record<string, unknown>) {
  return app.inject({
    method,
    url: `/api/setup${url}`,
    payload: body ?? (method === "POST" ? {} : undefined),
    remoteAddress: who.ip,
    headers: { host: who.host ?? "172.16.1.30:47300", ...who.headers, ...(who.session ? { "x-tentacle-setup": who.session } : {}) },
  });
}

const owner: Caller = { ip: "172.16.1.20" };
const neighbour: Caller = { ip: "172.16.1.21" };
const internet: Caller = { ip: "203.0.113.9" };
// Un mandataire voisin (Caddy, NPM…) sur le réseau de la pile.
const viaProxy = (client: string): Caller => ({ ip: "172.18.0.7", host: "172.16.1.30:47300", headers: { "x-forwarded-for": client } });

describe("ouvrir l'assistant sans code depuis le réseau local", () => {
  let session = "";

  it("avant tout : le réseau local n'aura pas de code à donner, Internet si", async () => {
    expect((await call("GET", "/host", owner)).json()).toMatchObject({ codeRequired: false });
    expect((await call("GET", "/host", internet)).json()).toMatchObject({ codeRequired: true });
    expect((await call("GET", "/host", viaProxy("203.0.113.9"))).json()).toMatchObject({ codeRequired: true });
  });

  it("Internet, ou un mandataire qui transmet une adresse publique : le code", async () => {
    for (const who of [internet, viaProxy("203.0.113.9"), { ...owner, host: "tentacle.example.com" }]) {
      const res = await call("POST", "/session/local", who);
      expect(res.statusCode).toBe(403);
      expect(res.json()).toEqual({ error: "code_required" });
    }
    expect(existsSync(SETUP_CLAIMANT_FILE)).toBe(false);
  });

  it("le premier navigateur du réseau local réclame l'installation, sans code", async () => {
    const res = await call("POST", "/session/local", owner);
    expect(res.statusCode).toBe(200);
    session = res.json().session;
    expect((await call("GET", "/context", { ...owner, session })).statusCode).toBe(200);
  });

  it("sa session ne sert à rien depuis une autre adresse", async () => {
    expect((await call("GET", "/context", { ...neighbour, session })).json()).toEqual({ error: "session_required" });
  });

  it("un second navigateur du réseau ne prend pas la place : le code", async () => {
    const res = await call("POST", "/session/local", neighbour);
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: "setup_in_progress" });
    expect((await call("GET", "/host", neighbour)).json()).toMatchObject({ codeRequired: true });
    // Pas plus à travers un mandataire de confiance.
    expect((await call("POST", "/session/local", viaProxy("192.168.1.77"))).json()).toEqual({ error: "setup_in_progress" });
  });

  it("celui qui l'a réclamée la retrouve (onglet fermé)", async () => {
    expect((await call("POST", "/session/local", owner)).statusCode).toBe(200);
  });

  it("avec le code, une autre adresse reprend l'installation", async () => {
    const code = readSetupToken();
    expect(code).toMatch(/^[0-9A-Z]{12}$/);
    const res = await call("POST", "/session", internet, { token: code });
    expect(res.statusCode).toBe(200);
    expect((await call("GET", "/context", { ...internet, session: res.json().session })).statusCode).toBe(200);
  });

  it("la fin de l'installation oublie qui l'avait réclamée", () => {
    expect(existsSync(SETUP_CLAIMANT_FILE)).toBe(true);
    sealSetup();
    expect(existsSync(SETUP_CLAIMANT_FILE)).toBe(false);
  });
});
