import { afterAll, beforeAll, describe, expect, it } from "vitest";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { request as httpRequest } from "http";
import type { AddressInfo } from "net";
import { join, resolve } from "path";
import { DATA_DIR } from "../../services/pluginManager";
import { DATA_ROOT } from "../../services/dataDir";
import { GuestSupervisor } from "./guestSupervisor";
import { createHostDispatcher } from "./hostDispatcher";
import { HOST_HANDLERS } from "./host/hostHandlers";
import type { PluginRuntimeManifest } from "./pluginServerRuntime";
import { registerPluginRelay } from "./relay/relayRoute";
import { setToolGrant } from "./tools/toolGrants";
import { LOG_REDACT_PATHS, redactUrl } from "../../services/logRedaction";

/**
 * Un VRAI invité, sous le modèle de permissions de Node, derrière le VRAI
 * relais : ce qu'il ne peut pas toucher (tentacle.db, .env, binaires), ce que
 * l'API d'hôte lui refuse, le flux audio avec Range, la relance après une
 * mort, l'arrêt quand l'extension est coupée.
 */

const PLUGIN = "isolation-test";
const pluginDir = resolve(DATA_DIR, PLUGIN);
const dataDir = join(pluginDir, "data");
const manifest: PluginRuntimeManifest = { kind: "isolated", entry: "guest.mjs", tools: ["yt-dlp"], publicRoutes: ["/headers"], hostApi: ["users", "tools"] };
const BIG = 64 * 1024 * 1024;

let supervisor: GuestSupervisor;
let app: FastifyInstance;
let base: string;
let enabled = true;
const logLines: string[] = [];

const fakeAuth = async (request: FastifyRequest, reply: FastifyReply) => {
  const auth = request.headers.authorization;
  if (auth !== "Bearer bon-jeton" && auth !== "Bearer sans-droit") return reply.status(401).send({ message: "Unauthorized" });
  const userId = auth === "Bearer bon-jeton" ? "u-1" : "u-2";
  (request as FastifyRequest & { user?: unknown }).user = { userId, username: "Zoé", isAdmin: true, session: "tvProfile" };
};

function get(path: string, headers: Record<string, string> = {}): Promise<{ status: number; headers: Record<string, unknown>; body: Buffer; firstByteMs: number }> {
  return new Promise((done, fail) => {
    const started = Date.now();
    const req = httpRequest(`${base}${path}`, { headers }, (res) => {
      let firstByteMs = -1;
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => {
        if (firstByteMs < 0) firstByteMs = Date.now() - started;
        chunks.push(chunk);
      });
      res.on("end", () => done({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks), firstByteMs }));
    });
    req.on("error", fail);
    req.end();
  });
}

const json = async (path: string, headers: Record<string, string> = { authorization: "Bearer bon-jeton" }) => JSON.parse((await get(path, headers)).body.toString());

beforeAll(async () => {
  mkdirSync(dataDir, { recursive: true });
  copyFileSync(join(__dirname, "__fixtures__", "fakeGuest.mjs"), join(pluginDir, "guest.mjs"));
  writeFileSync(join(DATA_ROOT, "tentacle.db"), "BASE SECRÈTE");
  writeFileSync(join(DATA_ROOT, ".env"), "JELLYFIN_API_KEY=secret");
  writeFileSync(join(pluginDir, "probes.json"), JSON.stringify({ db: join(DATA_ROOT, "tentacle.db"), env: join(DATA_ROOT, ".env"), outside: join(DATA_ROOT, "evil.txt") }));
  // Un « fichier audio » de 64 Mio, servi en flux par l'invité.
  writeFileSync(join(dataDir, "big.bin"), Buffer.alloc(BIG, 7));
  process.env.JELLYFIN_API_KEY = "ne-doit-jamais-passer";

  supervisor = new GuestSupervisor({
    pluginId: PLUGIN,
    manifest,
    paths: { pluginDir, dataDir, entry: join(pluginDir, "guest.mjs") },
    locale: () => "fr",
    onCall: createHostDispatcher({ pluginId: PLUGIN, manifest, pluginDir, dataDir }, HOST_HANDLERS),
    log: () => undefined,
  });
  supervisor.start();
  expect(await supervisor.whenReady(15_000)).toBe(true);

  // Le journal du serveur, avec SON sérialiseur (index.ts) : rien n'y passe en clair.
  app = Fastify({
    logger: {
      level: "info",
      stream: { write: (line: string) => void logLines.push(line) },
      redact: { paths: LOG_REDACT_PATHS, censor: "[redacted]" },
      serializers: { req: (request: { method: string; url: string }) => ({ method: request.method, url: redactUrl(request.url) }) },
    },
  });
  await registerPluginRelay(app, {
    lookup: (id) => (id === PLUGIN && enabled ? { manifest, ready: async () => ((await supervisor.whenReady(5_000)) ? supervisor.socket : null) } : null),
    serverLocale: () => "fr",
    // u-2 n'a pas le droit (users.rights → canUse faux).
    mayUse: async (_id, user) => user.userId === "u-1",
    authenticate: fakeAuth,
  });
  await app.listen({ port: 0, host: "127.0.0.1" });
  base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}/api/plugins/${PLUGIN}`;
}, 30_000);

afterAll(async () => {
  delete process.env.JELLYFIN_API_KEY;
  await supervisor?.stop("stop");
  await app?.close();
});

describe("isolation de l'invité (modèle de permissions de Node)", () => {
  it("ne lit ni tentacle.db ni .env, n'écrit qu'à ses données, ne lance rien, ne voit aucun secret", async () => {
    const probe = await json("/probe");
    expect(probe.readDb).toMatch(/^DENIED/);
    expect(probe.readEnv).toMatch(/^DENIED/);
    expect(probe.writeOutside).toMatch(/^DENIED/);
    expect(probe.writeData).toBe("OK undefined");
    expect(probe.symlinkDb).toMatch(/^DENIED/);
    expect(probe.hardlinkDb).toMatch(/^DENIED/);
    expect(probe.spawnBinary).toMatch(/^DENIED/);
    expect(probe.worker).toMatch(/^DENIED/);
    expect(probe.jellyfinKey).toBe("absent");
    // Fuseau et langue de l'hôte passent tels quels (`PASSTHROUGH_ENV`) quand il les a : la CI pose LANG, un poste non.
    const ownKeys = String(probe.envKeys).split(",").filter((key) => !["TZ", "LANG", "LC_ALL"].includes(key)).join(",");
    expect(ownKeys).toBe("TENTACLE_LOCALE,TENTACLE_PLUGIN_DATA_DIR,TENTACLE_PLUGIN_ID,TENTACLE_PLUGIN_SOCKET");
    expect(existsSync(join(DATA_ROOT, "evil.txt"))).toBe(false);
  });
});

describe("API d'hôte fermée", () => {
  const host = (method: string, params: unknown) => json(`/host?m=${encodeURIComponent(method)}&p=${encodeURIComponent(JSON.stringify(params))}`);

  it("une méthode inconnue ou d'une famille non déclarée est refusée", async () => {
    expect((await host("db.query", {})).error.code).toBe("forbidden");
    expect((await host("jellyfin.findByMbid", { recordings: [] })).error.code).toBe("forbidden");
    expect((await host("events.emit", { userIds: ["u"], event: { type: "music:pending" } })).error.code).toBe("forbidden");
  });

  it("des paramètres invalides sont refusés avant tout appel", async () => {
    expect((await host("tools.exec", { tool: "bash", args: [], timeoutMs: 5000 })).error.code).toBe("invalid");
    expect((await host("tools.spawnWorker", { tool: "yt-dlp", script: "/etc/x.py", name: "w" })).error.code).toBe("invalid");
  });

  it("un outil que l'administrateur n'a pas permis est refusé ; permis, --exec l'est toujours", async () => {
    const exec = { tool: "yt-dlp", args: ["--exec", "touch /tmp/pwned", "https://example.org/x"], timeoutMs: 5_000 };
    expect((await host("tools.exec", exec)).error.message).toBe("outil non permis par l'administrateur");
    setToolGrant(PLUGIN, "yt-dlp", true);
    const refused = await host("tools.exec", exec);
    expect(refused.error).toEqual({ code: "forbidden", message: "option refusée : --exec" });
    const info = await host("tools.info", { tool: "yt-dlp" });
    expect(info.value.allowed).toBe(true);
    setToolGrant(PLUGIN, "yt-dlp", false);
    expect((await host("tools.info", { tool: "yt-dlp" })).value).toEqual({ version: null, allowed: false });
  });
});

describe("relais HTTP", () => {
  it("exige la session, sauf sur une route publique", async () => {
    expect((await get("/probe")).status).toBe(401);
    expect((await get("/headers")).status).toBe(200);
  });

  it("un compte sans droit : 403, et l'invité n'est jamais contacté", async () => {
    const before = readFileSync(join(dataDir, "hits.log"), "utf8").length;
    const refused = await get("/probe", { authorization: "Bearer sans-droit" });
    expect(refused.status).toBe(403);
    expect(readFileSync(join(dataDir, "hits.log"), "utf8").length).toBe(before);
  });

  it("retire Authorization, cookies et x-tentacle-* du client ; pose RELAY_HEADERS", async () => {
    const forged = { cookie: "tentacle_token=x", "x-tentacle-user-id": "usurpe", "x-tentacle-is-admin": "1", "x-emby-token": "y" };
    const seen = await json("/whoami", { authorization: "Bearer bon-jeton", ...forged });
    expect(seen.authorization).toBeUndefined();
    expect(seen.cookie).toBeUndefined();
    expect(seen["x-emby-token"]).toBeUndefined();
    expect(seen["x-tentacle-user-id"]).toBe("u-1");
    expect(seen["x-tentacle-user-name"]).toBe("Zo%C3%A9");
    expect(seen["x-tentacle-is-admin"]).toBe("1");
    // Une session de profil de TV regarde : elle n'administre pas.
    expect(seen["x-tentacle-session"]).toBe("profile");
    expect(seen["x-tentacle-locale"]).toBe("fr");
    // `/headers` est publique : aucune identité, même usurpée.
    const anonymous = await json("/headers", forged);
    expect(anonymous["x-tentacle-user-id"]).toBeUndefined();
    expect(anonymous["x-tentacle-is-admin"]).toBeUndefined();
  });

  it("transmet Range et diffuse en flux, sans mettre l'audio en mémoire", async () => {
    const partial = await get("/stream", { authorization: "Bearer bon-jeton", range: "bytes=1048576-2097151" });
    expect(partial.status).toBe(206);
    expect(partial.headers["content-range"]).toBe(`bytes 1048576-2097151/${BIG}`);
    expect(partial.body.length).toBe(1_048_576);
    expect(partial.headers["set-cookie"]).toBeUndefined();

    (globalThis as { gc?: () => void }).gc?.();
    const heapBefore = process.memoryUsage().heapUsed;
    let peak = 0;
    const timer = setInterval(() => {
      peak = Math.max(peak, process.memoryUsage().heapUsed - heapBefore);
    }, 5);
    const full = await new Promise<{ size: number; firstByteMs: number; totalMs: number }>((done, fail) => {
      const started = Date.now();
      let size = 0;
      let firstByteMs = -1;
      httpRequest(`${base}/stream`, { headers: { authorization: "Bearer bon-jeton" } }, (res) => {
        res.on("data", (chunk: Buffer) => {
          if (firstByteMs < 0) firstByteMs = Date.now() - started;
          size += chunk.length;
        });
        res.on("end", () => done({ size, firstByteMs, totalMs: Date.now() - started }));
      }).on("error", fail).end();
    });
    clearInterval(timer);
    console.log(`[mesure] 64 Mio relayés : premier octet ${full.firstByteMs} ms, total ${full.totalMs} ms, pic de tas ${(peak / 1048576).toFixed(1)} Mio`);
    expect(full.size).toBe(BIG);
    // Le corps n'a jamais été tenu en entier par l'hôte.
    expect(peak).toBeLessThan(24 * 1024 * 1024);
  }, 30_000);
});

describe("relais HTTP : flux tenu et jeton en paramètre", () => {
  it("une réponse tenue de 5 s est relayée au fil de l'eau, Content-Length intact", async () => {
    const started = Date.now();
    let firstByteMs = -1;
    const out = await new Promise<{ length: string | undefined; size: number }>((done, fail) => {
      httpRequest(`${base}/slow`, { headers: { authorization: "Bearer bon-jeton" } }, (res) => {
        let size = 0;
        res.on("data", (c: Buffer) => {
          if (firstByteMs < 0) firstByteMs = Date.now() - started;
          size += c.length;
        });
        res.on("end", () => done({ length: res.headers["content-length"], size }));
      }).on("error", fail).end();
    });
    const totalMs = Date.now() - started;
    console.log(`[mesure] réponse tenue : premier octet ${firstByteMs} ms, fin ${totalMs} ms`);
    expect(out).toEqual({ length: String(10 * 1024), size: 10 * 1024 });
    expect(firstByteMs).toBeLessThan(1_500);
    expect(totalMs).toBeGreaterThanOrEqual(4_500);
  }, 20_000);

  it("GET + api_key valide : 200, l'invité ne voit jamais le paramètre ; api_key invalide : 401", async () => {
    const res = await get("/echo-url?x=1&api_key=bon-jeton&y=2");
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body.toString())).toEqual({ url: "/echo-url?x=1&y=2" });
    expect((await get("/echo-url?api_key=mauvais")).status).toBe(401);
  });

  it("POST + api_key : 401, même avec un jeton valide, sans contacter l'invité", async () => {
    const before = readFileSync(join(dataDir, "hits.log"), "utf8").length;
    const status = await new Promise<number>((done, fail) => {
      httpRequest(`${base}/echo-body?api_key=bon-jeton`, { method: "POST" }, (res) => {
        res.resume();
        done(res.statusCode ?? 0);
      }).on("error", fail).end("x");
    });
    expect(status).toBe(401);
    expect(readFileSync(join(dataDir, "hits.log"), "utf8").length).toBe(before);
  });

  it("le journal du serveur ne porte jamais le jeton", async () => {
    await get("/echo-url?api_key=bon-jeton");
    const logged = logLines.join("\n");
    expect(logged).toContain("/api/plugins/isolation-test/echo-url?api_key=[redacted]");
    expect(logged).not.toContain("bon-jeton");
  });
});

describe("relais HTTP : corps des requêtes", () => {
  it("un corps POST de 8 Mio arrive à l'invité en flux, entier", async () => {
    const body = Buffer.alloc(8 * 1024 * 1024, 1);
    const out = await new Promise<string>((done, fail) => {
      const req = httpRequest(`${base}/echo-body`, { method: "POST", headers: { authorization: "Bearer bon-jeton", "content-type": "application/octet-stream" } }, (res) => {
        let text = "";
        res.on("data", (c: Buffer) => { text += c.toString(); });
        res.on("end", () => done(text));
      });
      req.on("error", fail);
      req.end(body);
    });
    expect(JSON.parse(out)).toEqual({ size: body.length });
  });
});

describe("cycle de vie", () => {
  it("un invité tué est relancé (délai qui double, une seconde d'abord)", async () => {
    await get("/crash", { authorization: "Bearer bon-jeton" });
    await new Promise((r) => setTimeout(r, 200));
    expect(supervisor.state).toBe("backoff");
    expect(await supervisor.whenReady(10_000)).toBe(true);
    expect(supervisor.restarts).toBe(1);
    expect((await json("/probe")).readDb).toMatch(/^DENIED/);
  }, 20_000);

  it("extension coupée : shutdown reçu, plus aucun relais", async () => {
    enabled = false;
    await supervisor.stop("disabled");
    expect(readFileSync(join(dataDir, "shutdown.log"), "utf8").trim()).toBe("disabled");
    expect((await get("/probe", { authorization: "Bearer bon-jeton" })).status).toBe(404);
    expect(await supervisor.whenReady(100)).toBe(false);
  }, 20_000);
});
