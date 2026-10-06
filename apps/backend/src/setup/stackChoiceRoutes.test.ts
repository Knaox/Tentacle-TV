/**
 * Pile complète : le Jellyfin de la pile est proposé d'office, les autres
 * restent choisissables. On en choisit un autre (déjà configuré), on revient
 * à celui de la pile, puis on finit avec l'autre — sans jamais perdre la clé
 * du voisin verrouillé ni l'oublier au démarrage suivant.
 */

import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";
import { rmSync } from "fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { publicInfo, startFakeJellyfin, type FakeJellyfin } from "../../test/setup/fakeJellyfin";

const state = vi.hoisted(() => ({ config: new Map<string, string>(), appState: "setup_jellyfin" }));
vi.mock("../services/dataDir", async () => {
  const { mkdtempSync } = await import("fs");
  const { tmpdir } = await import("os");
  const { join } = await import("path");
  return { DATA_ROOT: mkdtempSync(join(tmpdir(), "wiz-stack-")) };
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
vi.mock("../services/db", () => ({ hasPrisma: () => true, hasDatabaseUrl: () => true, getDatabaseUrlSource: () => "env" }));
vi.mock("../services/jellyfinWs", () => ({ restartJellyfinWs: () => undefined }));
vi.mock("../services/jellyfinCors", () => ({ injectCorsHosts: async () => ({ added: [] }) }));
vi.mock("../services/backgroundServices", () => ({ startBackgroundServices: () => undefined }));
vi.mock("../services/jellyfinIdentity", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/jellyfinIdentity")>()),
  deviceIdForOpaque: async () => "dev-web",
}));
// Les faux Jellyfin écoutent sur la boucle locale, que la garde refuse dans Docker.
vi.mock("./jellyfin/guardedFetch", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./jellyfin/guardedFetch")>();
  return { ...actual, configureJellyfinGuard: () => actual.configureJellyfinGuard({ allowLoopback: true }) };
});
// La preuve « même réseau » est testée à part (siblingCheck) : ici, la pile est bien la pile.
vi.mock("./jellyfin/siblingCheck", () => ({ checkSiblingNetwork: async () => "same-network" }));

import { DATA_ROOT } from "../services/dataDir";
import { claimSiblingJellyfin } from "./provisioners/siblingClaim";
import { bootSetup } from "./setupRuntime";
import { setupWizardRoutes } from "./setupWizardRoutes";
import { readSetupToken } from "./setupToken";

const PASSWORD = "mot-de-passe-solide";
let stack: FakeJellyfin;
let other: FakeJellyfin;
let app: FastifyInstance;
let session = "";

const call = (method: "GET" | "POST", url: string, body?: unknown) =>
  app.inject({ method, url: `/api/setup${url}`, payload: body as Record<string, unknown> | undefined, headers: session ? { "x-tentacle-setup": session } : {}, remoteAddress: "192.168.1.20" });

function adminRoutes(jf: FakeJellyfin, key: string): void {
  jf.on("POST /Users/AuthenticateByName", ({ body }) =>
    (body as { Pw: string }).Pw === PASSWORD
      ? { status: 200, json: { AccessToken: "jeton", ServerId: "srv", User: { Id: "u1", Name: "Damien", ServerId: "srv", Policy: { IsAdministrator: true } } } }
      : { status: 401 },
  );
  // La clé n'existe qu'une fois créée : Jellyfin ne la rend pas à la création.
  let items: Array<{ AccessToken: string; AppName: string }> = key === "cle-pile" ? [{ AccessToken: key, AppName: "Tentacle" }] : [];
  jf.on("GET /Auth/Keys", () => ({ status: 200, json: { Items: items } }));
  jf.on("POST /Auth/Keys", () => ((items = [...items, { AccessToken: `${key}-${items.length + 1}`, AppName: "Tentacle" }]), { status: 204 }));
  jf.on("POST /Sessions/Logout", { status: 204 });
}

beforeAll(async () => {
  stack = await startFakeJellyfin();
  other = await startFakeJellyfin();
  // Le Jellyfin de la pile, verrouillé au démarrage par l'administrateur provisoire.
  stack.on("GET /System/Info/Public", () => publicInfo({ Id: "pile", ServerName: "Tentacle" }));
  adminRoutes(stack, "cle-pile");
  stack.on("GET /Users/prov", { status: 200, json: { Id: "prov", Name: "tentacle-setup" } });
  stack.on("POST /Users", { status: 204 });
  stack.on("POST /Users/Password", { status: 204 });
  stack.on("GET /System/Configuration", { status: 200, json: { UICulture: "en-US" } });
  stack.on("POST /System/Configuration", { status: 204 });
  // Un autre Jellyfin de la maison, DÉJÀ configuré.
  other.on("GET /System/Info/Public", () => publicInfo({ Id: "salon", ServerName: "Salon" }));
  adminRoutes(other, "cle-salon");

  Object.assign(process.env, { TENTACLE_DEPLOYMENT: "docker", TENTACLE_STACK: "full", JELLYFIN_INTERNAL_URL: stack.url, JELLYFIN_HOST_PORT: "47896" });
  for (const [key, value] of Object.entries({ jellyfin_url: stack.url, jellyfin_api_key: "cle-pile", jellyfin_server_id: "pile", jellyfin_claim_user_id: "prov" })) {
    state.config.set(key, value);
  }
  app = Fastify();
  await app.register(cookie);
  await app.register(rateLimit, { max: 1000, timeWindow: "1 minute" });
  await app.register(setupWizardRoutes, { prefix: "/api/setup" });
  bootSetup(3000);
  session = (await call("POST", "/session", { token: readSetupToken() })).json().session;
});

afterAll(async () => {
  await app.close();
  await stack.close();
  await other.close();
  for (const key of ["TENTACLE_DEPLOYMENT", "TENTACLE_STACK", "JELLYFIN_INTERNAL_URL", "JELLYFIN_HOST_PORT"]) delete process.env[key];
  rmSync(DATA_ROOT, { recursive: true, force: true });
});

describe("pile complète : choisir un autre Jellyfin que celui de la pile", () => {
  it("chacun dit ce qu'il est : celui de la pile, neuf tant qu'il est verrouillé ; l'autre, déjà configuré", async () => {
    expect((await call("POST", "/jellyfin/probe", { url: stack.url })).json()).toMatchObject({ serverId: "pile", inStack: true, blank: true, clientUrl: "http://localhost:47896" });
    expect((await call("POST", "/jellyfin/probe", { url: other.url })).json()).toMatchObject({ url: other.url, serverId: "salon", inStack: false, blank: false });
  });

  it("l'autre, choisi : relié par son compte, la clé du voisin mise de côté, rien à créer", async () => {
    expect((await call("POST", "/jellyfin/connect", { url: other.url, username: "Damien", password: PASSWORD })).json()).toEqual({ success: true });
    expect(state.config.get("jellyfin_url")).toBe(other.url);
    expect(state.config.get("jellyfin_claim_api_key")).toBe("cle-pile");
    expect(state.config.get("jellyfin_stack_choice")).toBe(other.url);
    expect((await call("GET", "/context")).json().jellyfin).toMatchObject({ url: other.url, configured: true, claimed: false, joined: true });
  });

  it("un redémarrage de Tentacle garde ce choix, sans toucher au voisin", async () => {
    expect(await claimSiblingJellyfin(stack.url, { log: () => undefined })).toBe("already");
    expect(state.config.get("jellyfin_url")).toBe(other.url);
  });

  it("retour sur celui de la pile : il reprend sa clé et prend le compte choisi", async () => {
    const init = await call("POST", "/jellyfin/initialize", { url: stack.url, username: "Damien", password: PASSWORD, uiCulture: "fr", metadataCountry: "FR", metadataLanguage: "fr" });
    expect(init.json()).toEqual({ success: true });
    expect(state.config.get("jellyfin_url")).toBe(stack.url);
    expect(state.config.get("jellyfin_api_key")).toBe("cle-pile");
    expect(stack.calls("POST /Users/Password")).toHaveLength(1);
    expect(state.config.has("jellyfin_claim_user_id")).toBe(false);
    expect(state.config.has("jellyfin_stack_choice")).toBe(false);
    expect((await call("GET", "/context")).json().jellyfin).toMatchObject({ url: stack.url, claimed: false, joined: false });
  });

  it("de nouveau l'autre, puis la fin : l'installation se ferme sur LUI", async () => {
    expect((await call("POST", "/jellyfin/connect", { url: other.url, username: "Damien", password: PASSWORD })).json()).toEqual({ success: true });
    const done = await call("POST", "/complete", { username: "Damien", password: PASSWORD });
    expect(done.statusCode).toBe(200);
    expect(state.config.get("jellyfin_url")).toBe(other.url);
    expect(state.config.get("jellyfin_private_url")).toBe(other.url.replace("127.0.0.1", "localhost"));
  });
});
