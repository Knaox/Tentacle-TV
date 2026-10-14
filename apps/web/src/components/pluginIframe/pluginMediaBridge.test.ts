import { describe, expect, it } from "vitest";
import {
  buildMediaBridgeListener, buildMediaBridgeMethod, buildMediaBridgeState, parsePluginMediaRequest, pluginMediaTarget,
} from "./pluginMediaBridge";

/**
 * Les octets du relais lus par l'hôte pour une extension : seulement le relais
 * des bandes-annonces, sur l'origine du serveur — et l'aller-retour du pont.
 */

const ORIGIN = "http://app.test";

describe("média du relais, lu par l'hôte", () => {
  it("n'accepte que le relais des bandes-annonces, sur l'origine du serveur", () => {
    expect(pluginMediaTarget("http://srv.test:3001", "http://srv.test:3001/api/trailers/hls/dm%3Ax8e90ff/p/v0.m3u8?t=a.b", ORIGIN))
      .toBe("http://srv.test:3001/api/trailers/hls/dm%3Ax8e90ff/p/v0.m3u8?t=a.b");
    expect(pluginMediaTarget("", "/api/trailers/hls/Way9Dexny3w/s/270/0.ts?t=x", ORIGIN)).toBe("http://app.test/api/trailers/hls/Way9Dexny3w/s/270/0.ts?t=x");
    expect(pluginMediaTarget("http://srv.test:3001", "http://srv.test:3001/api/admin/users", ORIGIN)).toBeNull();
    expect(pluginMediaTarget("http://srv.test:3001", "http://evil.test/api/trailers/hls/x", ORIGIN)).toBeNull();
    expect(pluginMediaTarget("http://srv.test/tentacle", "http://srv.test/tentacle/api/trailers/file/x.mp4?t=1", ORIGIN))
      .toBe("http://srv.test/tentacle/api/trailers/file/x.mp4?t=1");
  });

  it("valide la demande (plage d'octets comprise)", () => {
    expect(parsePluginMediaRequest({ id: 3, url: "/api/trailers/hls/x", range: "bytes=0-99" })).toEqual({ id: 3, url: "/api/trailers/hls/x", range: "bytes=0-99" });
    expect(parsePluginMediaRequest({ id: 3, url: "/x", range: "evil" })).toEqual({ id: 3, url: "/x" });
    expect(parsePluginMediaRequest({ url: "/x" })).toBeNull();
  });

  it("fetchMedia poste la demande et résout sur la réponse de l'hôte", async () => {
    const posted: Array<{ id: number }> = [];
    const parent = { postMessage: (message: { id: number }) => posted.push(message) };
    const script = `${buildMediaBridgeState()}
      var bridge = {${buildMediaBridgeMethod()}};
      function onMessage(e) { var data = e.data; ${buildMediaBridgeListener()} }
      return { bridge: bridge, onMessage: onMessage };`;
    const { bridge, onMessage } = new Function("parent", script)(parent) as {
      bridge: { fetchMedia: (url: string) => Promise<{ status: number; body: ArrayBuffer }> };
      onMessage: (e: { data: unknown; source: unknown }) => void;
    };
    const pending = bridge.fetchMedia("/api/trailers/hls/x/master.m3u8?t=1");
    expect(posted[0]).toMatchObject({ type: "MEDIA_REQUEST", url: "/api/trailers/hls/x/master.m3u8?t=1" });
    const body = new Uint8Array([1, 2]).buffer;
    onMessage({ source: parent, data: { type: "MEDIA_RESPONSE", id: posted[0]?.id, status: 200, body } });
    await expect(pending).resolves.toMatchObject({ status: 200, body });
  });
});
