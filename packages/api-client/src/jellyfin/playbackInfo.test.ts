import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchPlaybackInfo, type PlaybackInfoDeps } from "./playbackInfo";
import { JellyfinError } from "./types";
import type { PlaybackInfoResponse } from "@tentacle-tv/shared";

/**
 * L'aiguillage du PlaybackInfo : voie native quand l'hôte en donne une (elle
 * remplace le fetch de la page, voué au mur CORS sur la coquille), réponse du
 * serveur propagée telle quelle, panne de transport → direct coupé + proxy.
 */

const RESPONSE = { MediaSources: [] } as unknown as PlaybackInfoResponse;

function fakeDeps(): {
  deps: PlaybackInfoDeps;
  traces: { native: unknown[][]; proxy: string[]; blocks: string[] };
  native: { status: number; body: string; error: Error | null };
} {
  const traces = { native: [] as unknown[][], proxy: [] as string[], blocks: [] as string[] };
  const native = { status: 200, body: JSON.stringify(RESPONSE), error: null as Error | null };
  const deps: PlaybackInfoDeps = {
    directStreaming: { enabled: true, mediaBaseUrl: "https://jf.example", jellyfinToken: "jeton-u" },
    getAuthHeader: (t) => `MediaBrowser Token="${t ?? ""}"`,
    signalDirectBlocked: (reason) => {
      traces.blocks.push(reason);
    },
    viaProxy: (path) => {
      traces.proxy.push(path);
      return Promise.resolve(RESPONSE);
    },
    nativePlaybackInfo: (...args) => {
      traces.native.push(args);
      if (native.error !== null) return Promise.reject(native.error);
      return Promise.resolve({ status: native.status, body: native.body });
    },
  };
  return { deps, traces, native };
}

const OPTIONS = { userId: "u1", deviceProfile: {} as never };

describe("fetchPlaybackInfo — voie native", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("réponse 200 : corps parsé, ni proxy ni blocage, jeton UTILISATEUR", async () => {
    const { deps, traces } = fakeDeps();
    const r = await fetchPlaybackInfo(deps, "item1", OPTIONS);
    expect(r).toEqual(RESPONSE);
    expect(traces.proxy).toHaveLength(0);
    expect(traces.blocks).toHaveLength(0);
    // (baseUrl, itemId, query, token, authHeader, body)
    expect(traces.native[0]?.[0]).toBe("https://jf.example");
    expect(traces.native[0]?.[1]).toBe("item1");
    expect(traces.native[0]?.[3]).toBe("jeton-u");
  });

  it("réponse 403 : le serveur a parlé — JellyfinError, sans couper le direct", async () => {
    const { deps, traces, native } = fakeDeps();
    native.status = 403;
    await expect(fetchPlaybackInfo(deps, "item1", OPTIONS)).rejects.toBeInstanceOf(JellyfinError);
    expect(traces.blocks).toHaveLength(0);
    expect(traces.proxy).toHaveLength(0);
  });

  it("panne de transport : direct coupé, puis la même requête par le proxy", async () => {
    const { deps, traces, native } = fakeDeps();
    native.error = new Error("serveur injoignable");
    const r = await fetchPlaybackInfo(deps, "item1", OPTIONS);
    expect(r).toEqual(RESPONSE);
    expect(traces.blocks).toHaveLength(1);
    expect(traces.proxy).toHaveLength(1);
    expect(traces.proxy[0]).toContain("/Items/item1/PlaybackInfo?");
  });

  it("panne des DEUX voies (serveur média à terre) : l'erreur remonte, le direct n'est pas verrouillé", async () => {
    const { deps, traces, native } = fakeDeps();
    native.error = new Error("serveur injoignable");
    deps.viaProxy = () => Promise.reject(new JellyfinError(502, "Bad Gateway", "/Items"));
    await expect(fetchPlaybackInfo(deps, "item1", OPTIONS)).rejects.toMatchObject({ status: 502 });
    expect(traces.blocks).toHaveLength(0);
  });

  it("Tentacle muet aussi (erreur réseau du proxy) : pas de verrou", async () => {
    const { deps, traces, native } = fakeDeps();
    native.error = new Error("serveur injoignable");
    deps.viaProxy = () => Promise.reject(new TypeError("Network request failed"));
    await expect(fetchPlaybackInfo(deps, "item1", OPTIONS)).rejects.toBeInstanceOf(TypeError);
    expect(traces.blocks).toHaveLength(0);
  });

  it("le proxy obtient un refus 4xx de Jellyfin : la voie directe seule est en cause, verrou", async () => {
    const { deps, traces, native } = fakeDeps();
    native.error = new Error("serveur injoignable");
    deps.viaProxy = () => Promise.reject(new JellyfinError(403, "Forbidden", "/Items"));
    await expect(fetchPlaybackInfo(deps, "item1", OPTIONS)).rejects.toMatchObject({ status: 403 });
    expect(traces.blocks).toHaveLength(1);
  });

  it("sans direct streaming, la voie native ne se tente même pas", async () => {
    const { deps, traces } = fakeDeps();
    deps.directStreaming = null;
    const r = await fetchPlaybackInfo(deps, "item1", OPTIONS);
    expect(r).toEqual(RESPONSE);
    expect(traces.native).toHaveLength(0);
    expect(traces.proxy).toHaveLength(1);
  });
});

describe("fetchPlaybackInfo — voie fetch (TV, mobile, navigateur)", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("Jellyfin coupé : direct ET proxy en échec — rien n'est verrouillé pour la session", async () => {
    const { deps, traces } = fakeDeps();
    deps.nativePlaybackInfo = undefined;
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Network request failed")));
    deps.viaProxy = () => Promise.reject(new JellyfinError(502, "Bad Gateway", "/Items"));
    await expect(fetchPlaybackInfo(deps, "item1", OPTIONS)).rejects.toMatchObject({ status: 502 });
    expect(traces.blocks).toHaveLength(0);
  });

  it("voie directe fermée, proxy qui répond (CORS) : verrou, puis la réponse du proxy", async () => {
    const { deps, traces } = fakeDeps();
    deps.nativePlaybackInfo = undefined;
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const r = await fetchPlaybackInfo(deps, "item1", OPTIONS);
    expect(r).toEqual(RESPONSE);
    expect(traces.blocks).toHaveLength(1);
    expect(traces.proxy).toHaveLength(1);
  });
});
