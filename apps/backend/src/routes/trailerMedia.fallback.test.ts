/**
 * Le repli sur le lecteur officiel : une vidéo YouTube que le relais ne tient
 * pas passe par le garde des LECTURES ; refusée (pause, budget, seau du
 * compte), `/resolve` rend `409 { fallback: "embed" }` sans rien extraire, et
 * `/prepare` ne part pas. Une vidéo déjà tenue et Dailymotion ne demandent
 * rien au garde. yt-dlp est factice ; l'auth est réduite à « un jeton ».
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtractionResult } from "../services/trailers/ytExtract";

const { extractTrailerSource } = vi.hoisted(() => ({ extractTrailerSource: vi.fn<(ytId: string) => Promise<ExtractionResult>>() }));
vi.mock("../services/trailers/ytExtract", () => ({ extractTrailerSource }));
vi.mock("../services/ytDlp", () => ({ startYtDlpUpdates: () => {} }));
vi.mock("undici", async (original) => ({ ...(await original<typeof import("undici")>()), fetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args) }));
vi.mock("../middleware/auth", () => ({
  requireAuth: async (request: { headers: Record<string, unknown>; user?: unknown }) => {
    request.user = { userId: "u1" };
  },
}));

import { ID, googlevideo, hls, server } from "./trailerMediaTestKit";
import { resetTrailerRelay } from "../services/trailers/trailerRelay";
import { resetYouTubeGuard, tripYouTubeBreaker } from "../services/trailers/youtubeGuard";

beforeEach(() => {
  resetTrailerRelay();
  resetYouTubeGuard();
  extractTrailerSource.mockReset();
  extractTrailerSource.mockResolvedValue(hls(1));
  vi.stubGlobal("fetch", googlevideo(1));
});
afterEach(() => {
  vi.unstubAllGlobals();
  resetYouTubeGuard();
});

describe("repli sur le lecteur officiel", () => {
  it("YouTube en pause : 409 { fallback: embed }, sans extraction ; /prepare ne part pas", async () => {
    // La lecture-sonde passe une fois toutes les 5 minutes : elle part la première.
    tripYouTubeBreaker("bot");
    const app = await server();
    expect((await app.inject({ url: `/api/trailers/resolve?ytId=${ID}` })).statusCode).toBe(200);
    resetTrailerRelay();
    extractTrailerSource.mockClear();
    const res = await app.inject({ url: `/api/trailers/resolve?ytId=${ID}` });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ fallback: "embed", reason: "blocked" });
    expect((await app.inject({ url: `/api/trailers/prepare?ytId=${ID}` })).json()).toEqual({ status: "skipped" });
    expect(extractTrailerSource).not.toHaveBeenCalled();
  });

  it("une vidéo que le relais tient ne demande rien au garde, même en pause", async () => {
    const app = await server();
    expect((await app.inject({ url: `/api/trailers/resolve?ytId=${ID}` })).statusCode).toBe(200);
    tripYouTubeBreaker("limit");
    expect((await app.inject({ url: `/api/trailers/resolve?ytId=${ID}` })).statusCode).toBe(200);
    expect(extractTrailerSource).toHaveBeenCalledTimes(1);
  });

  it("le seau du compte : au-delà de ses lectures d'avance, le lecteur officiel", async () => {
    const app = await server();
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) {
      resetTrailerRelay();
      statuses.push((await app.inject({ url: `/api/trailers/resolve?ytId=${ID}` })).statusCode);
    }
    expect(statuses.slice(0, 10).every((s) => s === 200)).toBe(true);
    expect(statuses.at(-1)).toBe(409);
  });
});
