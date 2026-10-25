/**
 * Le relais annonce les ÉCRITURES que l'invité accepte (`onWrite`) : c'est
 * ainsi que la navigation réglée par une extension se relit aussitôt après son
 * enregistrement. Une lecture, ou une écriture refusée, n'annonce rien.
 */

import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import { createServer, type Server } from "http";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { registerPluginRelay } from "./relayRoute";
import type { PluginRuntimeManifest } from "../pluginServerRuntime";

const manifest = { kind: "isolated", entry: "server/index.mjs", hostApi: [] } as unknown as PluginRuntimeManifest;
const onWrite = vi.fn();
let app: FastifyInstance;
let guest: Server;
let folder: string;

beforeAll(async () => {
  folder = mkdtempSync(join(tmpdir(), "relay-write-"));
  const socket = join(folder, "g.sock");
  guest = createServer((req, res) => {
    req.resume();
    res.writeHead(req.url?.startsWith("/refuse") ? 400 : 200, { "content-type": "application/json" });
    res.end("{}");
  });
  await new Promise<void>((done) => guest.listen(socket, done));
  app = Fastify();
  await registerPluginRelay(app, {
    lookup: (id) => (id === "x" ? { manifest, ready: async () => socket } : null),
    serverLocale: () => "fr",
    mayUse: async () => true,
    authenticate: async (request: FastifyRequest) => {
      (request as FastifyRequest & { user?: unknown }).user = { userId: "u", username: "admin", isAdmin: true, session: "personal" };
    },
    onWrite,
  });
});

afterAll(async () => {
  await app.close();
  await new Promise<void>((done) => guest.close(() => done()));
  rmSync(folder, { recursive: true, force: true });
});

beforeEach(() => onWrite.mockClear());

describe("relais : écritures annoncées", () => {
  it("un PUT accepté annonce sa route, sans la requête", async () => {
    const res = await app.inject({ method: "PUT", url: "/api/plugins/x/navigation?a=1", payload: { items: [] } });
    expect(res.statusCode).toBe(200);
    expect(onWrite).toHaveBeenCalledWith("x", "/navigation");
  });

  it("une lecture n'annonce rien", async () => {
    await app.inject({ method: "GET", url: "/api/plugins/x/navigation" });
    expect(onWrite).not.toHaveBeenCalled();
  });

  it("une écriture refusée par l'invité n'annonce rien", async () => {
    const res = await app.inject({ method: "PUT", url: "/api/plugins/x/refuse", payload: {} });
    expect(res.statusCode).toBe(400);
    expect(onWrite).not.toHaveBeenCalled();
  });
});
