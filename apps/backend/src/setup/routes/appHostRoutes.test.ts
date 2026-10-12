import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  packaging: "windows-app" as string | null,
  refuse: null as string | null,
  visible: new Set<string>(),
  answers: new Map<string, unknown>(),
  asked: [] as { method: string; params: unknown }[],
}));

vi.mock("../setupGuard", () => ({ requireSetupSession: async () => undefined }));
vi.mock("../setupRuntime", () => ({ setupRuntime: () => ({ deployment: { packaging: state.packaging } }) }));
vi.mock("../flow/setupFlow", async () => {
  const { SetupError } = await import("../setupErrors");
  return {
    requireStep: (action: string) => {
      if (state.refuse === action) throw new SetupError("step_refused");
      return {};
    },
  };
});
vi.mock("../setupStore", () => ({ storedJellyfin: () => ({ url: "http://127.0.0.1:8096", apiKey: "k" }) }));
vi.mock("../jellyfin/libraries", () => ({ folderVisible: async (_url: string, _key: string, path: string) => state.visible.has(path) }));

import { startHostChannel } from "../../serverHost/hostChannel";
import { setupErrorHandler } from "../setupErrors";
import { setupAppHostRoutes } from "./appHostRoutes";

/** Un faux hôte : il annonce ses gestes, puis répond à chaque question par la réponse préparée. */
const listeners: { message: ((m: unknown) => void)[] } = { message: [] };
startHostChannel(
  { shutdown: () => undefined, status: async () => ({ bootId: "b", appState: "setup_jellyfin", playbackActive: null, restartPending: false }) },
  {
    connected: true,
    send: (message: unknown, callback: (error: Error | null) => void) => {
      const m = message as { type: string; id: string; method: string; params?: unknown };
      if (m.type === "tentacle:request") {
        state.asked.push({ method: m.method, params: m.params });
        const result = state.answers.get(m.method);
        setImmediate(() => listeners.message.forEach((l) => l({ type: "tentacle:response", id: m.id, ok: result !== undefined, result, error: "failed" })));
      }
      callback(null);
      return true;
    },
    on: (event: string, listener: (m?: unknown) => void) => {
      if (event === "message") listeners.message.push(listener as (m: unknown) => void);
      return undefined;
    },
  },
);
const hello = (methods: string[]) => listeners.message.forEach((l) => l({ type: "tentacle:host-hello", protocol: 1, hostVersion: "1.0.0", methods }));

const ABSENT = { state: "absent", mode: null, version: null, url: "http://127.0.0.1:8920", port: 8920, canStart: false, installer: "available", installing: false };
let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify();
  await app.register(rateLimit, { max: 1000, timeWindow: "1 minute" });
  await app.register(async (scope) => {
    scope.setErrorHandler(setupErrorHandler);
    await scope.register(setupAppHostRoutes);
  }, { prefix: "/api/setup" });
});
afterAll(() => app.close());
beforeEach(() => {
  state.packaging = "windows-app";
  state.refuse = null;
  state.visible = new Set();
  state.answers = new Map();
  state.asked = [];
  hello(["jellyfin.detect", "jellyfin.install", "jellyfin.installStatus", "jellyfin.start", "dialog.pickFolder"]);
});

const call = (method: "GET" | "POST", url: string, options: { body?: Record<string, unknown>; ip?: string } = {}) =>
  app.inject({ method, url: `/api/setup${url}`, payload: options.body, remoteAddress: options.ip ?? "127.0.0.1" });

describe("gestes de l'app Windows dans l'assistant", () => {
  it("hors de l'app, ou sans hôte qui les sert : host_unavailable", async () => {
    state.packaging = null;
    expect((await call("GET", "/jellyfin/local")).json()).toEqual({ error: "host_unavailable" });
    state.packaging = "windows-app";
    hello([]);
    const reply = await call("GET", "/jellyfin/local");
    expect(reply.statusCode).toBe(409);
    expect(reply.json()).toEqual({ error: "host_unavailable" });
  });

  it("la détection relayée, sans le port, avec la page officielle", async () => {
    state.answers.set("jellyfin.detect", ABSENT);
    const { port: _port, ...rest } = ABSENT;
    expect((await call("GET", "/jellyfin/local")).json()).toEqual({ ...rest, docsUrl: "https://jellyfin.org/downloads/windows" });
  });

  it("installer : jamais par-dessus un Jellyfin déjà là, et toujours dans le parcours", async () => {
    state.answers.set("jellyfin.detect", { ...ABSENT, state: "stopped", mode: "tray" });
    expect((await call("POST", "/jellyfin/install")).json()).toEqual({ error: "step_refused" });
    expect(state.asked.map((a) => a.method)).toEqual(["jellyfin.detect"]);
    state.answers.set("jellyfin.detect", ABSENT);
    state.answers.set("jellyfin.install", { phase: "resolving", version: null, receivedBytes: 0, totalBytes: null, failure: null });
    expect((await call("POST", "/jellyfin/install")).json()).toMatchObject({ phase: "resolving", docsUrl: "https://jellyfin.org/downloads/windows" });
    state.refuse = "installJellyfin";
    expect((await call("GET", "/jellyfin/install")).json()).toEqual({ error: "step_refused" });
  });

  it("démarrer : la réponse de l'hôte telle quelle (un service se démarre dans Services)", async () => {
    state.answers.set("jellyfin.start", { started: false, reason: "service" });
    expect((await call("POST", "/jellyfin/start")).json()).toEqual({ started: false, reason: "service" });
  });

  it("la boîte « Choisir un dossier » : seulement depuis la machine même", async () => {
    state.answers.set("dialog.pickFolder", { path: "D:\\Films", unc: null });
    expect((await call("POST", "/jellyfin/pick-folder", { ip: "203.0.113.9" })).json()).toEqual({ error: "host_unavailable" });
    expect(state.asked).toEqual([]);
  });

  it("le dossier choisi repasse par Jellyfin ; un lecteur mappé refusé propose son chemin réseau", async () => {
    state.answers.set("dialog.pickFolder", { path: "D:\\Films", unc: null });
    state.visible.add("D:\\Films");
    expect((await call("POST", "/jellyfin/pick-folder", { body: { title: "Films" } })).json()).toEqual({ status: "picked", path: "D:\\Films" });
    expect(state.asked[0]).toEqual({ method: "dialog.pickFolder", params: { title: "Films" } });
    state.answers.set("dialog.pickFolder", { path: "Z:\\Films", unc: "\\\\NAS\\films" });
    expect((await call("POST", "/jellyfin/pick-folder")).json()).toEqual({ status: "mapped_drive", path: "Z:\\Films", unc: "\\\\NAS\\films" });
    state.answers.set("dialog.pickFolder", { path: "E:\\Rien", unc: null });
    expect((await call("POST", "/jellyfin/pick-folder")).json()).toEqual({ status: "not_found", path: "E:\\Rien" });
    state.answers.set("dialog.pickFolder", { path: null });
    expect((await call("POST", "/jellyfin/pick-folder")).json()).toEqual({ status: "cancelled" });
  });

  it("un corps inconnu est refusé", async () => {
    expect((await call("POST", "/jellyfin/pick-folder", { body: { path: "C:\\" } })).json()).toEqual({ error: "invalid_input" });
  });
});
