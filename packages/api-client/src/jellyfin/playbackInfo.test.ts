import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchPlaybackInfo, type PlaybackInfoDeps } from "./playbackInfo";
import { JellyfinError } from "./types";
import type { PlaybackInfoResponse } from "@tentacle-tv/shared";

/**
 * L'aiguillage du PlaybackInfo : voie native quand l'hôte en donne une (elle
 * remplace le fetch de la page, voué au mur CORS sur la coquille), réponse du
 * serveur propagée telle quelle, panne de transport → direct coupé + proxy.
 */

const REPONSE = { MediaSources: [] } as unknown as PlaybackInfoResponse;

function fauxDeps(): {
  deps: PlaybackInfoDeps;
  traces: { natif: unknown[][]; proxy: string[]; blocages: string[] };
  natif: { statut: number; corps: string; erreur: Error | null };
} {
  const traces = { natif: [] as unknown[][], proxy: [] as string[], blocages: [] as string[] };
  const natif = { statut: 200, corps: JSON.stringify(REPONSE), erreur: null as Error | null };
  const deps: PlaybackInfoDeps = {
    directStreaming: { enabled: true, mediaBaseUrl: "https://jf.example", jellyfinToken: "jeton-u" },
    getAuthHeader: (t) => `MediaBrowser Token="${t ?? ""}"`,
    signalerDirectBloque: (raison) => {
      traces.blocages.push(raison);
    },
    viaProxy: (path) => {
      traces.proxy.push(path);
      return Promise.resolve(REPONSE);
    },
    nativePlaybackInfo: (...args) => {
      traces.natif.push(args);
      if (natif.erreur !== null) return Promise.reject(natif.erreur);
      return Promise.resolve({ status: natif.statut, body: natif.corps });
    },
  };
  return { deps, traces, natif };
}

const OPTIONS = { userId: "u1", deviceProfile: {} as never };

describe("fetchPlaybackInfo — voie native", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("réponse 200 : corps parsé, ni proxy ni blocage, jeton UTILISATEUR", async () => {
    const { deps, traces } = fauxDeps();
    const r = await fetchPlaybackInfo(deps, "item1", OPTIONS);
    expect(r).toEqual(REPONSE);
    expect(traces.proxy).toHaveLength(0);
    expect(traces.blocages).toHaveLength(0);
    // (baseUrl, itemId, query, token, authHeader, body)
    expect(traces.natif[0]?.[0]).toBe("https://jf.example");
    expect(traces.natif[0]?.[1]).toBe("item1");
    expect(traces.natif[0]?.[3]).toBe("jeton-u");
  });

  it("réponse 403 : le serveur a parlé — JellyfinError, sans couper le direct", async () => {
    const { deps, traces, natif } = fauxDeps();
    natif.statut = 403;
    await expect(fetchPlaybackInfo(deps, "item1", OPTIONS)).rejects.toBeInstanceOf(JellyfinError);
    expect(traces.blocages).toHaveLength(0);
    expect(traces.proxy).toHaveLength(0);
  });

  it("panne de transport : direct coupé, puis la même requête par le proxy", async () => {
    const { deps, traces, natif } = fauxDeps();
    natif.erreur = new Error("serveur injoignable");
    const r = await fetchPlaybackInfo(deps, "item1", OPTIONS);
    expect(r).toEqual(REPONSE);
    expect(traces.blocages).toHaveLength(1);
    expect(traces.proxy).toHaveLength(1);
    expect(traces.proxy[0]).toContain("/Items/item1/PlaybackInfo?");
  });

  it("sans direct streaming, la voie native ne se tente même pas", async () => {
    const { deps, traces } = fauxDeps();
    deps.directStreaming = null;
    const r = await fetchPlaybackInfo(deps, "item1", OPTIONS);
    expect(r).toEqual(REPONSE);
    expect(traces.natif).toHaveLength(0);
    expect(traces.proxy).toHaveLength(1);
  });
});
