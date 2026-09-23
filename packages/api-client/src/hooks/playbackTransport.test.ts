/**
 * La voie proxy des reports de lecture, sur la coquille : elle passe par le
 * relais natif — c'est lui qui, à la fermeture, annonce l'arrêt de ce qu'il a
 * vu passer. Ailleurs (web, mobile, TV), rien ne change : `client.fetch`.
 */

import { describe, expect, it, vi } from "vitest";
import { sessionPost, type JfClient } from "./playbackTransport";

function client(overrides: Partial<JfClient> = {}): JfClient & { fetch: ReturnType<typeof vi.fn> } {
  return {
    fetch: vi.fn(() => Promise.resolve(undefined)),
    getBaseUrl: () => "https://tentacle.example/api/jellyfin",
    getToken: () => "jeton",
    getDeviceId: () => "appareil",
    getAuthHeader: (token?: string) => `MediaBrowser Client="Tentacle TV", Token="${token ?? "jeton"}"`,
    useCredentials: false,
    getDirectStreaming: () => null,
    ...overrides,
  } as JfClient & { fetch: ReturnType<typeof vi.fn> };
}

const BODY = { ItemId: "item1", PositionTicks: 10 };

describe("sessionPost — voie proxy", () => {
  it("coquille : relayée par le processus principal, vers le proxy, avec le jeton", async () => {
    const native = vi.fn(() => Promise.resolve(204));
    const c = client({ nativeSessionPost: native });
    await sessionPost(c, "/Sessions/Playing/Progress", BODY, "test");
    expect(native).toHaveBeenCalledWith(
      "https://tentacle.example/api/jellyfin",
      "/Sessions/Playing/Progress",
      "jeton",
      'MediaBrowser Client="Tentacle TV", Token="jeton"',
      JSON.stringify(BODY),
    );
    expect(c.fetch).not.toHaveBeenCalled();
  });

  it("coquille : un 401 reste de la télémétrie — ni repli, ni déconnexion", async () => {
    const c = client({ nativeSessionPost: vi.fn(() => Promise.resolve(401)) });
    await sessionPost(c, "/Sessions/Playing/Progress", BODY, "test");
    expect(c.fetch).not.toHaveBeenCalled();
  });

  it("coquille : le relais en panne retombe sur le fetch de la page", async () => {
    const c = client({ nativeSessionPost: vi.fn(() => Promise.reject(new Error("ipc"))) });
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await sessionPost(c, "/Sessions/Playing/Progress", BODY, "test");
    expect(c.fetch).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });

  it("hors coquille : le fetch de la page, comme avant", async () => {
    const c = client();
    await sessionPost(c, "/Sessions/Playing/Stopped", BODY, "test");
    expect(c.fetch).toHaveBeenCalledWith(
      "/Sessions/Playing/Stopped",
      { method: "POST", body: JSON.stringify(BODY) },
      { noAuthExpiry: true },
    );
  });
});
