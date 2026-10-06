import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";
import { rmSync } from "fs";
import { Writable } from "stream";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { publicInfo, startFakeJellyfin, type FakeJellyfin } from "../../test/setup/fakeJellyfin";

const state = vi.hoisted(() => {
  delete process.env.TENTACLE_DEPLOYMENT;
  return { config: new Map<string, string>(), appState: "setup_jellyfin", started: 0, segments: [] as unknown[] };
});
// Le code d'installation et le verrou s'écrivent dans un dossier jetable.
vi.mock("../services/dataDir", async () => {
  const { mkdtempSync } = await import("fs");
  const { tmpdir } = await import("os");
  const { join } = await import("path");
  return { DATA_ROOT: mkdtempSync(join(tmpdir(), "wiz-routes-")) };
});
vi.mock("../services/configStore", () => ({
  getConfigValue: (key: string) => state.config.get(key),
  setConfigValue: async (key: string, value: string) => void state.config.set(key, value),
  deleteConfigValue: async (key: string) => void state.config.delete(key),
  detectAppState: async () => state.appState,
  getAppState: () => state.appState,
  setAppState: (value: string) => void (state.appState = value),
  isSetupComplete: () => state.config.get("setup_completed") === "true",
}));
vi.mock("../services/db", () => ({
  hasPrisma: () => true,
  hasDatabaseUrl: () => true,
  getDatabaseUrlSource: () => "env",
  reconnectPrisma: async () => true,
  reinitPrisma: async () => true,
  saveDatabaseUrl: () => undefined,
}));
vi.mock("../services/jellyfinWs", () => ({ restartJellyfinWs: () => undefined }));
vi.mock("../services/jellyfinCors", () => ({ injectCorsHosts: async () => ({ added: [] }) }));
vi.mock("../services/segmentPlugins/segmentSetupJob", () => ({
  startSegmentSetup: async (request: unknown) => void state.segments.push(request),
  segmentSetupStatus: () => ({ phase: "repositories", running: true }),
}));
vi.mock("../services/backgroundServices", () => ({ startBackgroundServices: () => void (state.started += 1) }));
vi.mock("../services/jellyfinIdentity", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/jellyfinIdentity")>()),
  deviceIdFor: async () => "dev-setup",
  deviceIdForOpaque: async () => "dev-web",
  ensureInstallId: async () => "install",
}));

import { DATA_ROOT } from "../services/dataDir";
import { bootSetup } from "./setupRuntime";
import { setupWizardRoutes } from "./setupWizardRoutes";
import { readSetupToken } from "./setupToken";

const API_KEY = "a1b2c3d4e5f60718293a4b5c6d7e8f90";
const ADMIN_PASSWORD = "mot-de-passe-solide";

let jf: FakeJellyfin;
let app: FastifyInstance;
const logs: string[] = [];
const bodies: string[] = [];

async function buildApp(): Promise<FastifyInstance> {
  const stream = new Writable({ write: (chunk, _enc, done) => void (logs.push(String(chunk)), done()) });
  const instance = Fastify({ logger: { level: "debug", stream } });
  await instance.register(cookie);
  await instance.register(rateLimit, { max: 1000, timeWindow: "1 minute" });
  await instance.register(setupWizardRoutes, { prefix: "/api/setup" });
  instance.addHook("onSend", async (_request, _reply, payload) => {
    bodies.push(String(payload));
    return payload;
  });
  return instance;
}

function call(method: "GET" | "POST", url: string, options: { body?: unknown; session?: string; ip?: string } = {}) {
  return app.inject({
    method,
    url: `/api/setup${url}`,
    payload: options.body as Record<string, unknown> | undefined,
    headers: options.session ? { "x-tentacle-setup": options.session } : {},
    remoteAddress: options.ip ?? "192.168.1.20",
  });
}

beforeAll(async () => {
  jf = await startFakeJellyfin();
  let keys: { AccessToken: string; AppName: string }[] = [];
  let wizardDone = false;
  jf.on("GET /System/Info/Public", () => publicInfo({ StartupWizardCompleted: wizardDone }));
  for (const route of ["POST /Startup/Configuration", "POST /Startup/User", "POST /Startup/RemoteAccess"]) jf.on(route, { status: 204 });
  jf.on("GET /Startup/User", { status: 200, json: { Name: "root" } });
  jf.on("POST /Startup/Complete", () => ((wizardDone = true), { status: 204 }));
  jf.on("POST /Users/AuthenticateByName", ({ body }) =>
    (body as { Pw: string }).Pw === ADMIN_PASSWORD
      ? { status: 200, json: { AccessToken: "jeton-web", ServerId: "srv", User: { Id: "u1", Name: "Damien", ServerId: "srv", Policy: { IsAdministrator: true } } } }
      : { status: 401 },
  );
  jf.on("GET /Auth/Keys", () => ({ status: 200, json: { Items: keys } }));
  jf.on("POST /Auth/Keys", () => ((keys = [...keys, { AccessToken: API_KEY, AppName: "Tentacle" }]), { status: 204 }));
  jf.on("POST /Sessions/Logout", { status: 204 });
  jf.on("GET /Library/VirtualFolders", { status: 200, json: [] });
  jf.on("POST /Environment/ValidatePath", { status: 204 });
  jf.on("POST /Library/VirtualFolders", { status: 204 });
  jf.on("POST /Library/Refresh", { status: 204 });
  app = await buildApp();
  bootSetup(3000);
});

afterAll(async () => {
  await app.close();
  await jf.close();
  rmSync(DATA_ROOT, { recursive: true, force: true });
});

describe("assistant d'installation, de bout en bout", () => {
  let session = "";

  it("sans session : rien ; l'état public reste lisible", async () => {
    expect((await call("GET", "/context")).json()).toEqual({ error: "session_required" });
    expect((await call("GET", "/context", { session: "x".repeat(43) })).statusCode).toBe(401);
    expect((await call("GET", "/status")).json()).toMatchObject({ setupOpen: true });
  });

  it("avant le code : ce que le serveur sait de lui-même, sans session et sans secret", async () => {
    const res = await call("GET", "/host");
    expect(res.statusCode).toBe(200);
    expect(Object.keys(res.json()).sort()).toEqual(["codeRequired", "containerId", "containerized", "deployment", "stack"]);
    expect(res.json()).toMatchObject({ deployment: "native", stack: null });
    expect(res.body).not.toContain(readSetupToken() ?? "absent");
  });

  it("un code faux est refusé ; au-delà de 5 par minute, l'adresse attend", async () => {
    const wrong = await call("POST", "/session", { body: { token: "AAAA-AAAA-AAAA" }, ip: "10.9.9.9" });
    expect(wrong.statusCode).toBe(401);
    expect(wrong.json()).toEqual({ error: "invalid_token" });
    for (let i = 0; i < 4; i++) await call("POST", "/session", { body: { token: "AAAA-AAAA-AAAA" }, ip: "10.9.9.9" });
    const limited = await call("POST", "/session", { body: { token: "AAAA-AAAA-AAAA" }, ip: "10.9.9.9" });
    expect(limited.statusCode).toBe(429);
    expect(limited.json()).toEqual({ error: "rate_limited" });
  });

  it("le bon code ouvre UNE session, puis ne sert plus", async () => {
    const code = readSetupToken();
    expect(code).toMatch(/^[0-9A-Z]{12}$/);
    const opened = await call("POST", "/session", { body: { token: `${code!.slice(0, 4).toLowerCase()} ${code!.slice(4)}` } });
    expect(opened.statusCode).toBe(200);
    session = opened.json().session;
    expect(readSetupToken()).toBeNull();
    expect((await call("POST", "/session", { body: { token: code } })).json()).toEqual({ error: "invalid_token" });
  });

  it("un champ inconnu est un refus, pas un champ ignoré", async () => {
    const res = await call("POST", "/jellyfin/probe", { session, body: { url: jf.url, extra: 1 } });
    expect(res.json()).toEqual({ error: "invalid_input" });
  });

  it("la base d'une pile ne se change pas par l'assistant", async () => {
    const res = await call("POST", "/database", { session, body: { host: "db", port: 3306, database: "x", user: "u", password: "p" } });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: "db_managed_by_stack" });
  });

  it("Jellyfin vierge : sondé, initialisé, clé créée — jamais renvoyée", async () => {
    const probe = await call("POST", "/jellyfin/probe", { session, body: { url: jf.url } });
    expect(probe.json()).toEqual({ url: jf.url, version: "10.11.11", serverName: "jellyfin", blank: true, compatible: true, clientUrl: jf.url.replace("127.0.0.1", "localhost") });
    const init = await call("POST", "/jellyfin/initialize", {
      session,
      body: { url: jf.url, username: "Damien", password: ADMIN_PASSWORD, uiCulture: "fr-FR", metadataCountry: "CH", metadataLanguage: "fr" },
    });
    expect(init.json()).toEqual({ success: true });
    expect(state.config.get("jellyfin_api_key")).toBe(API_KEY);
    const context = (await call("GET", "/context", { session })).json();
    expect(context).toMatchObject({ deployment: "native", provisioner: "native-host", jellyfin: { url: jf.url, configured: true, claimed: false } });
  });

  it("les bibliothèques proposées sont créées", async () => {
    const res = await call("POST", "/jellyfin/libraries", {
      session,
      body: { libraries: [{ name: "Films", type: "movies", paths: ["/media/films"] }], metadataLanguage: "fr", metadataCountry: "CH" },
    });
    expect(res.json()).toEqual([{ name: "Films", status: "created" }]);
  });

  it("la détection des passages part en fond, sans jamais forcer un redémarrage pendant une lecture", async () => {
    expect((await call("POST", "/jellyfin/segments")).statusCode).toBe(401);
    const res = await call("POST", "/jellyfin/segments", { session, body: { restartWhilePlaying: true } });
    expect(res.statusCode).toBe(202);
    expect(res.json()).toEqual({ phase: "repositories", running: true });
    expect(state.segments).toEqual([{ restartWhilePlaying: false }]);
    expect((await call("GET", "/jellyfin/segments", { session })).json()).toMatchObject({ running: true });
  });

  it("la fin : connecté comme après un login, et l'assistant fermé pour toujours", async () => {
    expect((await call("POST", "/complete", { session, body: { username: "Damien", password: "faux" } })).json()).toEqual({ error: "jf_bad_credentials" });
    const done = await call("POST", "/complete", { session, body: { username: "Damien", password: ADMIN_PASSWORD } });
    expect(done.statusCode).toBe(200);
    expect(done.json()).toMatchObject({ success: true, AccessToken: "jeton-web", DeviceId: "dev-web", User: { Id: "u1", Name: "Damien" } });
    expect(done.cookies.find((c) => c.name === "tentacle_token")).toMatchObject({ httpOnly: true, sameSite: "Strict" });
    expect(state.config.get("setup_completed")).toBe("true");
    // L'adresse des applications : le Jellyfin de la boucle locale prend l'hôte du navigateur.
    expect(state.config.get("jellyfin_private_url")).toBe(jf.url.replace("127.0.0.1", "localhost"));
    expect(state.started).toBe(1);

    for (const [method, url] of [["GET", "/host"], ["GET", "/context"], ["POST", "/session"], ["POST", "/jellyfin/probe"], ["POST", "/jellyfin/segments"], ["POST", "/complete"]] as const) {
      const res = await call(method, url, { session, body: method === "POST" ? {} : undefined });
      expect(res.statusCode, url).toBe(404);
      expect(res.json()).toEqual({ error: "setup_closed" });
    }
    expect((await call("GET", "/status")).json()).toMatchObject({ state: "running", setupOpen: false });
  });

  it("ni la clé de Jellyfin ni un mot de passe dans une réponse ou un journal", () => {
    const everything = [...bodies, ...logs].join("\n");
    expect(everything).not.toContain(API_KEY);
    expect(everything).not.toContain(ADMIN_PASSWORD);
  });
});
