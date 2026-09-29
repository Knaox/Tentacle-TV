import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./configStore", () => ({ getJellyfinUrl: () => "http://jellyfin.test", getJellyfinApiKey: () => "cle-admin-123456" }));

import { jellyfinAcceptsLegacyAuth, resetLegacyAuthProbeForTests } from "./jellyfinLegacyAuth";

const fetchMock = vi.fn();
beforeEach(() => {
  resetLegacyAuthProbeForTests();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("jellyfinAcceptsLegacyAuth", () => {
  it("sonde avec X-Emby-Token : 200 = acceptée (10.10, 10.11 par défaut)", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    expect(await jellyfinAcceptsLegacyAuth()).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://jellyfin.test/System/Info");
    expect((init.headers as Record<string, string>)["X-Emby-Token"]).toBe("cle-admin-123456");
  });

  it("401 = refusée (12.x par défaut, 10.11 option coupée), et gardé en cache", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 401 }));
    expect(await jellyfinAcceptsLegacyAuth()).toBe(false);
    expect(await jellyfinAcceptsLegacyAuth()).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("injoignable : dans le doute, le comportement d'avant", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    expect(await jellyfinAcceptsLegacyAuth()).toBe(true);
  });
});
