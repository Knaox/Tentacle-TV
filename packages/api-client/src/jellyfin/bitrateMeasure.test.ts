import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JellyfinClient } from "../jellyfin";

/**
 * La mesure de débit suit la voie du média : le serveur Jellyfin quand le
 * direct est ouvert (et demandé), le proxy sinon — et une mesure demandée sur
 * une autre voie pendant qu'une première est en vol n'est pas perdue.
 */

type Direct = { enabled: boolean; mediaBaseUrl: string; jellyfinToken: string } | null;

function fakeClient(direct: { current: Direct }): JellyfinClient {
  return {
    getDirectStreaming: () => direct.current,
    getAuthHeader: (token?: string) => `MediaBrowser Token="${token ?? "proxy"}"`,
    getAccessToken: () => "jwt",
    getBaseUrl: () => "https://tentacle.test/api/jellyfin",
    useCredentials: false,
  } as unknown as JellyfinClient;
}

let calls: string[] = [];

beforeEach(() => {
  vi.resetModules();
  calls = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    calls.push(url);
    await new Promise((resolve) => setTimeout(resolve, 5));
    return new Response(new Uint8Array(16), { status: 200 });
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe("bitrateMeasure", () => {
  it("mesure le serveur Jellyfin quand le direct est ouvert et demandé", async () => {
    const { measureBitrate } = await import("./bitrateMeasure");
    const direct = { current: { enabled: true, mediaBaseUrl: "http://jf.lan:8096", jellyfinToken: "tok" } as Direct };
    await measureBitrate(fakeClient(direct), { preferDirect: true });
    expect(calls).toEqual(["http://jf.lan:8096/Playback/BitrateTest?size=3000000"]);
  });

  it("sans préférence, le proxy", async () => {
    const { measureBitrate } = await import("./bitrateMeasure");
    const direct = { current: { enabled: true, mediaBaseUrl: "http://jf.lan:8096", jellyfinToken: "tok" } as Direct };
    await measureBitrate(fakeClient(direct));
    expect(calls[0]).toContain("tentacle.test/api/jellyfin/Playback/BitrateTest");
  });

  it("enchaîne la mesure directe demandée pendant celle du proxy", async () => {
    const { primeBitrateMeasure } = await import("./bitrateMeasure");
    const direct = { current: null as Direct };
    const client = fakeClient(direct);
    primeBitrateMeasure(client, { preferDirect: true }); // direct pas encore ouvert : proxy
    direct.current = { enabled: true, mediaBaseUrl: "http://jf.lan:8096", jellyfinToken: "tok" };
    primeBitrateMeasure(client, { preferDirect: true }); // pendant le vol du proxy
    await vi.waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[1]).toBe("http://jf.lan:8096/Playback/BitrateTest?size=3000000");
  });
});
