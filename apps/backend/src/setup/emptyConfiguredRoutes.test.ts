/**
 * Un Jellyfin DÉJÀ configuré (un administrateur existe) mais SANS AUCUNE
 * bibliothèque — le cas vécu sous Portainer : l'assistant disait « aucune
 * bibliothèque » sans proposer d'en créer. La connexion le constate ; le
 * parcours gagne l'écran des bibliothèques, et le serveur permet alors d'en
 * créer — seulement dans ce cas. Avec des bibliothèques, toujours refusé.
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
  return { DATA_ROOT: mkdtempSync(join(tmpdir(), "wiz-empty-")) };
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
vi.mock("./jellyfin/guardedFetch", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./jellyfin/guardedFetch")>();
  return { ...actual, configureJellyfinGuard: () => actual.configureJellyfinGuard({ allowLoopback: true }) };
});

import { DATA_ROOT } from "../services/dataDir";
import { bootSetup } from "./setupRuntime";
import { setupWizardRoutes } from "./setupWizardRoutes";
import { readSetupToken } from "./setupToken";

const PASSWORD = "mot-de-passe-solide";
let empty: FakeJellyfin;
let full: FakeJellyfin;
let app: FastifyInstance;
let session = "";
let folders: Array<{ Name: string; CollectionType: string; Locations: string[] }> = [];

const call = (method: "GET" | "POST", url: string, body?: unknown) =>
  app.inject({ method, url: `/api/setup${url}`, payload: body as Record<string, unknown> | undefined, headers: session ? { "x-tentacle-setup": session } : {}, remoteAddress: "192.168.1.20" });

function configured(jf: FakeJellyfin, id: string, key: string): void {
  jf.on("GET /System/Info/Public", () => publicInfo({ Id: id, ServerName: id }));
  jf.on("POST /Users/AuthenticateByName", () => ({ status: 200, json: { AccessToken: "jeton", ServerId: id, User: { Id: "u1", Name: "Knaoxtest", ServerId: id, Policy: { IsAdministrator: true } } } }));
  let items: Array<{ AccessToken: string; AppName: string }> = [];
  jf.on("GET /Auth/Keys", () => ({ status: 200, json: { Items: items } }));
  jf.on("POST /Auth/Keys", () => ((items = [{ AccessToken: key, AppName: "Tentacle" }]), { status: 204 }));
  jf.on("POST /Sessions/Logout", { status: 204 });
  jf.on(`DELETE /Auth/Keys/${key}`, { status: 204 });
}

beforeAll(async () => {
  empty = await startFakeJellyfin();
  full = await startFakeJellyfin();
  configured(empty, "vide", "cle-vide");
  empty.on("GET /Library/VirtualFolders", () => ({ status: 200, json: folders }));
  empty.on("GET /Environment/Drives", { status: 200, json: [{ Name: "/", Path: "/" }] });
  empty.on("POST /Environment/ValidatePath", { status: 204 });
  empty.on("POST /Library/VirtualFolders", ({ query }) => {
    folders = [...folders, { Name: query.get("name") ?? "", CollectionType: query.get("collectionType") ?? "", Locations: ["/srv/films"] }];
    return { status: 204 };
  });
  empty.on("POST /Library/Refresh", { status: 204 });
  configured(full, "plein", "cle-plein");
  full.on("GET /Library/VirtualFolders", { status: 200, json: [{ Name: "Films", CollectionType: "movies", Locations: ["/data/films"] }] });

  Object.assign(process.env, { TENTACLE_DEPLOYMENT: "docker", TENTACLE_STACK: "db" });
  app = Fastify();
  await app.register(cookie);
  await app.register(rateLimit, { max: 1000, timeWindow: "1 minute" });
  await app.register(setupWizardRoutes, { prefix: "/api/setup" });
  bootSetup(3000);
  session = (await call("POST", "/session", { token: readSetupToken() })).json().session;
});

afterAll(async () => {
  await app.close();
  await empty.close();
  await full.close();
  for (const key of ["TENTACLE_DEPLOYMENT", "TENTACLE_STACK"]) delete process.env[key];
  rmSync(DATA_ROOT, { recursive: true, force: true });
});

const flow = async () => (await call("GET", "/context")).json().flow;
const create = () => call("POST", "/jellyfin/libraries", { libraries: [{ name: "Films", type: "movies", paths: ["/srv/films"] }], metadataLanguage: "fr", metadataCountry: "FR" });

describe("Jellyfin déjà configuré, sans bibliothèque", () => {
  it("avant la connexion, on ne sait pas : rien à créer", async () => {
    expect((await call("POST", "/jellyfin/select", { url: empty.url })).json().flow).toMatchObject({ linked: false, noLibraries: false, selection: { path: "configured" } });
    expect((await create()).json()).toEqual({ error: "step_refused" });
  });

  it("la connexion le constate : l'écran des bibliothèques entre dans le parcours", async () => {
    expect((await call("POST", "/jellyfin/connect", { url: empty.url, username: "Knaoxtest", password: PASSWORD })).json()).toEqual({ success: true });
    expect(await flow()).toMatchObject({ linked: true, noLibraries: true, selection: { path: "configured", noLibraries: true } });
  });

  it("parcourir ses dossiers et créer de VRAIES bibliothèques Jellyfin y sont permis ; jamais un compte", async () => {
    expect((await call("GET", "/jellyfin/browse")).json()).toEqual({ path: null, parent: null, entries: [{ name: "/", path: "/" }], style: "posix" });
    expect((await create()).json()).toEqual([{ name: "Films", status: "created" }]);
    expect(empty.calls("POST /Library/VirtualFolders")).toHaveLength(1);
    const init = await call("POST", "/jellyfin/initialize", { url: empty.url, username: "X", password: PASSWORD, uiCulture: "fr", metadataCountry: "FR", metadataLanguage: "fr" });
    expect(init.json()).toEqual({ error: "step_refused" });
  });

  it("créées, le parcours ne bouge plus (gardé jusqu'au prochain choix) : l'installation reste numérotée pareil", async () => {
    expect(await flow()).toMatchObject({ noLibraries: true });
  });
});

describe("Jellyfin déjà configuré AVEC des bibliothèques", () => {
  it("un autre choix oublie le constat ; ici, rien à créer, même relié", async () => {
    expect((await call("POST", "/jellyfin/select", { url: full.url })).json().flow).toMatchObject({ noLibraries: false, selection: { path: "configured" } });
    expect((await call("POST", "/jellyfin/connect", { url: full.url, username: "Knaoxtest", password: PASSWORD })).json()).toEqual({ success: true });
    expect(await flow()).toMatchObject({ linked: true, noLibraries: false });
    expect((await flow()).selection.noLibraries).toBeUndefined();
    expect((await create()).json()).toEqual({ error: "step_refused" });
    expect((await call("GET", "/jellyfin/browse")).json()).toEqual({ error: "step_refused" });
    expect(full.calls("POST /Library/VirtualFolders")).toHaveLength(0);
  });
});
