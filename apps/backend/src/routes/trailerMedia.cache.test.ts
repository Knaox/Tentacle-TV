/**
 * Le relais des bandes-annonces, suite : ce que le navigateur garde (un
 * aperçu, immuable jusqu'à l'échéance de son jeton ; une lecture, ses
 * segments seulement) et les pannes de googlevideo — un refus passager jamais
 * gardé, une panne en 502, un délai en 504, jamais un 500. yt-dlp et
 * googlevideo sont factices ; l'auth est réduite à « un jeton ».
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtractionResult } from "../services/trailers/ytExtract";

const { extractTrailerSource } = vi.hoisted(() => ({ extractTrailerSource: vi.fn<(ytId: string) => Promise<ExtractionResult>>() }));
vi.mock("../services/trailers/ytExtract", () => ({ extractTrailerSource }));
vi.mock("../services/ytDlp", () => ({ startYtDlpUpdates: () => {} }));
// Le relais lit googlevideo par le `fetch` du paquet undici : renvoyé ici vers le global, que chaque test remplace.
vi.mock("undici", async (original) => ({ ...(await original<typeof import("undici")>()), fetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args) }));
vi.mock("../middleware/auth", () => ({
  requireAuth: async (request: { headers: Record<string, unknown> }, reply: { status: (c: number) => { send: (b: unknown) => unknown } }) => {
    if (request.headers.authorization !== "Bearer ok") return reply.status(401).send({ message: "Unauthorized" });
  },
}));

import { ID, googlevideo, hls, resolved, server } from "./trailerMediaTestKit";
import { mediaCacheControl, playlistCacheControl } from "./trailerMedia";
import { resetTrailerRelay } from "../services/trailers/trailerRelay";
import { signRelayToken } from "../services/trailers/relayToken";

beforeEach(() => {
  resetTrailerRelay();
  extractTrailerSource.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("flux relayés — le cache du navigateur et les pannes amont", () => {
  it("un APERÇU reste dans le cache du navigateur — listes et segments, immuables jusqu'à l'échéance du jeton ; une lecture ne garde pas ses listes", async () => {
    extractTrailerSource.mockResolvedValue(hls(1));
    vi.stubGlobal("fetch", googlevideo(1));
    const app = await server();
    const play = new URL(await resolved(app), "http://x").searchParams.get("t") as string;
    const preview = signRelayToken(ID, Date.now(), "preview");
    for (const name of ["master.m3u8", "master-1080.m3u8", "p/95.m3u8"]) {
      expect((await app.inject({ url: `/api/trailers/hls/${ID}/${name}?t=${preview}` })).headers["cache-control"]).toBe("private, max-age=3600, immutable");
      expect((await app.inject({ url: `/api/trailers/hls/${ID}/${name}?t=${play}` })).headers["cache-control"]).toBe("private, no-store");
    }
    expect((await app.inject({ url: `/api/trailers/hls/${ID}/s/95/0.ts?t=${preview}` })).headers["cache-control"]).toBe("private, max-age=3600, immutable");
    expect((await app.inject({ url: `/api/trailers/hls/${ID}/s/95/0.ts?t=${play}` })).headers["cache-control"]).toBe("private, max-age=3600");
    // Près de son échéance, un jeton d'aperçu ne se garde plus qu'une minute avant elle — puis plus du tout.
    const expiry = (parseInt(preview.split(".")[0], 36)) * 1000;
    const access = { token: preview, scope: "preview" as const };
    expect(playlistCacheControl(access, expiry - 10 * 60_000)).toBe("private, max-age=540, immutable");
    expect(mediaCacheControl(access, expiry - 30_000)).toBe("private, no-store");
  });

  it("un refus PASSAGER de googlevideo (503, 429) est relayé tel quel, jamais gardé par le navigateur : la reprise de hls.js le redemande", async () => {
    extractTrailerSource.mockResolvedValue(hls(1));
    const pages = googlevideo(1);
    let status = 503;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (url.includes("/sq/") ? new Response("busy", { status }) : pages(url))));
    const app = await server();
    const preview = signRelayToken(ID, Date.now(), "preview");
    const play = new URL(await resolved(app), "http://x").searchParams.get("t") as string;
    for (const token of [preview, play]) {
      const res = await app.inject({ url: `/api/trailers/hls/${ID}/s/95/0.ts?t=${token}` });
      expect([res.statusCode, res.headers["cache-control"]]).toEqual([503, "private, no-store"]);
    }
    status = 429;
    const res = await app.inject({ url: `/api/trailers/hls/${ID}/s/95/0.ts?t=${preview}` });
    expect([res.statusCode, res.headers["cache-control"]]).toEqual([429, "private, no-store"]);
  });

  it("une panne amont se dit en 502, un délai en 504 — jamais en 500", async () => {
    extractTrailerSource.mockResolvedValue(hls(1));
    const pages = googlevideo(1);
    let failure: Error = new TypeError("fetch failed");
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/sq/")) throw failure;
      return pages(url);
    }));
    const app = await server();
    const token = new URL(await resolved(app), "http://x").searchParams.get("t");
    const url = `/api/trailers/hls/${ID}/s/95/0.ts?t=${token}`;
    expect([(await app.inject({ url })).statusCode, (await app.inject({ url })).json()]).toEqual([502, { error: "upstream" }]);
    failure = new DOMException("délai", "TimeoutError");
    expect((await app.inject({ url })).statusCode).toBe(504);
  });
});
