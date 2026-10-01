import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchStreamingConfig, StreamingConfigUnavailable } from "./useStreamingConfig";

const DIRECT = { enabled: true, mediaBaseUrl: "http://jellyfin.lan:8096", jellyfinToken: "jeton", deviceId: "tv-1" };

function answer(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), { status });
}

afterEach(() => vi.unstubAllGlobals());

describe("fetchStreamingConfig — une panne ne vaut pas « désactivé »", () => {
  it("pas de réponse du serveur : rejet, l'appelant garde son état", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Network request failed")));
    await expect(fetchStreamingConfig("jeton")).rejects.toBeInstanceOf(StreamingConfigUnavailable);
  });

  it("5xx (serveur à terre derrière son mandataire) : la même panne", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(answer(502)));
    await expect(fetchStreamingConfig("jeton")).rejects.toMatchObject({ status: 502 });
  });

  it("réponse avec jeton : lecture directe", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(answer(200, { directStreaming: DIRECT })));
    await expect(fetchStreamingConfig("jeton")).resolves.toEqual(DIRECT);
  });

  it("réponse au jeton nul explicite : un MODE (proxy), rendu tel quel", async () => {
    const proxy = { ...DIRECT, jellyfinToken: null };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(answer(200, { directStreaming: proxy })));
    await expect(fetchStreamingConfig("jeton")).resolves.toEqual(proxy);
  });

  it("refus 4xx : désactivé, comme avant", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(answer(401)));
    await expect(fetchStreamingConfig("jeton")).resolves.toMatchObject({ enabled: false, jellyfinToken: null });
  });

  it("sans session : désactivé, sans requête", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await expect(fetchStreamingConfig(null)).resolves.toMatchObject({ enabled: false });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
