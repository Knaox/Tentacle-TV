/**
 * Le jeton dans l'URL (`?api_key=`) : accepté par les SEULS `GET` du flux et
 * des pochettes, jugé par la vraie garde (`requireAuth`, Jellyfin bouchonné
 * par le `fetch` global), jamais ailleurs, et jamais écrit dans un journal.
 */

import { Writable } from "node:stream";
import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { redactUrl } from "../../services/logRedaction";
import { acceptsQueryToken } from "./mediaQueryToken";
import { musicRoutes } from "./musicRoutes";

const GOOD = "jeton-du-banc-0123456789";
const ITEM = "c".repeat(32);
const ROW = { id: ITEM, kind: "track", imageTag: null };

// Un serveur 1.40.0 : les fonctions d'Octave et des extensions isolées y sont déclarées (declaredCapabilities.ts).
const serverVersion = vi.hoisted(() => ({ value: "1.40.0" }));
vi.mock("../../services/version", () => ({
  get BACKEND_VERSION() {
    return serverVersion.value;
  },
}));
vi.mock("../../services/configStore", () => ({
  getJellyfinUrl: () => "http://jf.test",
  getJellyfinApiKey: () => "cle",
  getConfigValue: () => undefined,
}));
vi.mock("../../services/jwt", () => ({
  verifyImpersonationToken: async () => null,
  verifyDeviceToken: async () => null,
  hashToken: (value: string) => value,
}));
vi.mock("../musicService", () => ({ ensureMusicIndex: () => undefined }));
vi.mock("./requestView", () => ({
  userOf: () => ({ userId: "u1" }),
  viewOf: async () => ({ userId: "u1", access: { mode: "all", libraryId: "lib" }, favorites: new Set() }),
}));
vi.mock("../index/indexQueries", () => ({ rowById: async () => ROW }));
vi.mock("../media/playbackSource", () => ({ playableRow: async () => ROW, sourceFor: async () => null }));
vi.mock("../media/streamRelay", () => ({
  AUDIO_BYTES: { compress: false },
  relayStream: async (_request: unknown, reply: { type: (t: string) => { send: (b: string) => unknown } }) => reply.type("audio/flac").send("octets"),
}));
vi.mock("../media/artworkCache", () => ({
  artworkSize: () => 256,
  artworkFor: async () => ({ bytes: Buffer.from("img"), contentType: "image/jpeg", immutable: true }),
}));

const logs: string[] = [];

beforeEach(() => {
  logs.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const auth = new Headers(init?.headers).get("authorization") ?? "";
      if (String(input).includes("/Users/Me")) {
        return auth.includes(GOOD)
          ? new Response(JSON.stringify({ Id: "u1", Name: "octave1", Policy: { IsAdministrator: false } }), { status: 200 })
          : new Response("", { status: 401 });
      }
      return new Response("{}", { status: 404 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Le même journal que le serveur (index.ts) : l'URL passe par `redactUrl`. */
async function makeApp() {
  const stream = new Writable({ write(chunk, _enc, done) { logs.push(String(chunk)); done(); } });
  const app = Fastify({
    logger: {
      level: "info",
      stream,
      serializers: { req: (request) => ({ method: request.method, url: redactUrl(request.url) }) },
    },
  });
  await app.register(musicRoutes, { prefix: "/api/music" });
  return app;
}

describe("?api_key= sur la musique", () => {
  it("jeton valide : le flux et la pochette répondent", async () => {
    const app = await makeApp();
    const stream = await app.inject({ method: "GET", url: `/api/music/stream/${ITEM}?api_key=${GOOD}` });
    expect(stream.statusCode).toBe(200);
    expect(stream.body).toBe("octets");
    const artwork = await app.inject({ method: "GET", url: `/api/music/artwork/${ITEM}?size=256&ApiKey=${GOOD}` });
    expect(artwork.statusCode).toBe(200);
    await app.close();
  });

  it("jeton invalide : 401", async () => {
    const app = await makeApp();
    for (const path of [`/api/music/stream/${ITEM}`, `/api/music/artwork/${ITEM}`]) {
      expect((await app.inject({ method: "GET", url: `${path}?api_key=faux-jeton` })).statusCode).toBe(401);
    }
    await app.close();
  });

  it("toute autre route, ou une autre méthode, l'ignore : 401", async () => {
    const app = await makeApp();
    for (const url of ["/api/music/status", `/api/music/source/${ITEM}`, "/api/music/search?q=a", "/api/music/liked"]) {
      expect((await app.inject({ method: "GET", url: `${url}${url.includes("?") ? "&" : "?"}api_key=${GOOD}` })).statusCode).toBe(401);
    }
    const report = await app.inject({ method: "POST", url: `/api/music/playback?api_key=${GOOD}`, payload: { itemId: ITEM, positionMs: 0, event: "start" } });
    expect(report.statusCode).toBe(401);
    expect(acceptsQueryToken("HEAD", "/api/music/stream/:id")).toBe(false);
    expect(acceptsQueryToken("GET", "/api/music/stream/:id")).toBe(true);
    await app.close();
  });

  it("le jeton n'apparaît dans aucun journal", async () => {
    const app = await makeApp();
    await app.inject({ method: "GET", url: `/api/music/stream/${ITEM}?api_key=${GOOD}` });
    await app.inject({ method: "GET", url: `/api/music/artwork/${ITEM}?api_key=${GOOD}` });
    await app.inject({ method: "GET", url: `/api/music/status?api_key=${GOOD}` });
    await app.close();
    const all = logs.join("\n");
    expect(all).toContain("api_key=[redacted]");
    expect(all).not.toContain(GOOD);
  });
});
