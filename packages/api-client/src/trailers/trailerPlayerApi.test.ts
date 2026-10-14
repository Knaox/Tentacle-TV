import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchTrailerResolve, reportTrailerPlayback } from "./trailerPlayerApi";

const SERVER = "http://srv.test:3000";
const yt = { kind: "youtube" as const, ytId: "Way9Dexny3w" };
const dm = { kind: "dailymotion" as const, videoId: "x8e90ff" };

function respond(status: number, body: unknown) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe("le flux du lecteur complet", () => {
  it("demande `dmId` pour Dailymotion et rend les adresses absolues", async () => {
    const fetchMock = respond(200, { path: "/api/trailers/hls/dm%3Ax8e90ff/master.m3u8?t=a.b", mimeType: "application/vnd.apple.mpegurl", qualities: [], subtitles: [], language: "fr-FR" });
    const result = await fetchTrailerResolve(dm, SERVER);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/trailers/resolve?dmId=x8e90ff");
    expect(result).toEqual({ status: "ready", stream: expect.objectContaining({ url: `${SERVER}/api/trailers/hls/dm%3Ax8e90ff/master.m3u8?t=a.b`, type: "m3u8", language: "fr-FR" }) });
  });

  it("traduit les refus : lecteur officiel, indisponible, panne", async () => {
    respond(409, { fallback: "embed" });
    expect(await fetchTrailerResolve(yt, SERVER)).toEqual({ status: "embed" });
    respond(404, { error: "unavailable" });
    expect(await fetchTrailerResolve(yt, SERVER)).toEqual({ status: "unavailable" });
    respond(500, { error: "x" });
    expect(await fetchTrailerResolve(yt, SERVER)).toEqual({ status: "failed" });
    respond(200, { path: "https://evil.test/x" });
    expect(await fetchTrailerResolve(yt, SERVER)).toEqual({ status: "unavailable" });
  });

  it("rend compte sans jamais échouer, même sur un 204", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(() => reportTrailerPlayback(dm, { ok: true, ms: 420 })).not.toThrow();
    await Promise.resolve();
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(JSON.parse(String(init?.body))).toEqual({ dmId: "x8e90ff", ok: true, ms: 420 });
  });
});
