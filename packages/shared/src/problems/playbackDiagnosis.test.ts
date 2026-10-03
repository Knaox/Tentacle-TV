import { afterEach, describe, expect, it, vi } from "vitest";
import { hlsFailure, mediaElementFailure } from "./engineErrors";
import { collectPlaybackFailure, diagnosePlaybackFailure, isPlayerFault, lowerQualityTier, type PlaybackFailureContext } from "./playbackDiagnosis";

/**
 * La chaîne commune d'un échec de lecture : du signalement (moteur, requête,
 * constat) à la cause, sondes comprises — celle des serveurs, puis le flux
 * et le fichier source quand le moteur n'a rien dit de décisif.
 */

const CTX: PlaybackFailureContext = {
  streamUrl: "http://serveur/Videos/1/master.m3u8?api_key=secret",
  headers: {},
  started: false,
  transcoding: true,
  burningSubtitles: false,
  sourceUrl: "http://serveur/Videos/1/stream?static=true&api_key=secret",
};

const ok = { probeServers: async () => "ok" as const };

function answer(status: number, body = "", type = "application/json"): Response {
  return new Response(body, { status, headers: { "content-type": type } });
}

afterEach(() => vi.unstubAllGlobals());

describe("diagnostic d'un échec de lecture", () => {
  it("hls.js et <video> passent par la même forme que les moteurs du mobile", () => {
    const hls = collectPlaybackFailure({ from: "engine", failure: hlsFailure({ type: "networkError", details: "manifestLoadError", response: { code: 404 } }) });
    expect(hls.raw).toMatchObject({ status: 404, target: "stream" });
    expect(hls.facts.engine).toBe("hls.js");
    const decode = collectPlaybackFailure({ from: "engine", failure: mediaElementFailure(3, "PIPELINE_ERROR_DECODE") });
    expect(decode.raw.kind).toBe("decode");
    // Source refusée : format ou adresse, la sonde du flux tranchera.
    const refused = collectPlaybackFailure({ from: "engine", failure: mediaElementFailure(4, "MEDIA_ELEMENT_ERROR: Format error") });
    expect(refused.facts.code).toBe("MEDIA_ERR_SRC_NOT_SUPPORTED");
  });

  it("un serveur muet l'emporte sur tout le reste, sans sonder le flux", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const result = await diagnosePlaybackFailure({ from: "marker", marker: "startTimeout" }, CTX, { probeServers: async () => "backend" });
    expect(result.cause).toBe("serverUnreachable");
    expect(result.context).toBe("playbackStart");
  });

  it("une conversion qui échoue : le maître répond, le premier segment non", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("static=true")) return answer(200, "x", "video/mp4");
      if (url.includes("master.m3u8")) return answer(200, "#EXTM3U\nmain.m3u8?x=1", "application/vnd.apple.mpegurl");
      if (url.includes("main.m3u8")) return answer(200, "#EXTM3U\n#EXTINF:6,\nseg0.ts", "application/vnd.apple.mpegurl");
      return answer(500);
    }));
    const result = await diagnosePlaybackFailure({ from: "marker", marker: "startTimeout" }, CTX, ok);
    expect(result.cause).toBe("transcodeFailed");
    expect(result.details).toContainEqual({ key: "errors:detailHttp", values: { status: 500 } });
  });

  it("le fichier source absent du disque se dit, même quand le maître HLS répond", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (url.includes("static=true") ? answer(404) : answer(200, "x", "video/mp2t"))));
    const result = await diagnosePlaybackFailure({ from: "marker", marker: "startTimeout" }, CTX, ok);
    expect(result.cause).toBe("fileMissing");
  });

  it("la fiche introuvable, une lecture déjà commencée, un fichier local disparu", async () => {
    // Le fichier source répondrait 404 lui aussi : il n'est pas interrogé.
    vi.stubGlobal("fetch", vi.fn(async () => answer(404)));
    const gone = await diagnosePlaybackFailure(
      { from: "request", error: Object.assign(new Error("Media server API error 404"), { status: 404 }), target: "relayed", request: "GET /Items/1" },
      { ...CTX, streamUrl: null },
      ok,
    );
    expect(gone.cause).toBe("itemNotFound");
    expect(gone.details).toContainEqual({ key: "errors:detailRequest", values: { request: "GET /Items/1" } });

    vi.stubGlobal("fetch", vi.fn(async () => answer(200, "x", "video/mp2t")));
    const stopped = await diagnosePlaybackFailure(
      { from: "engine", failure: hlsFailure({ type: "networkError", details: "fragLoadError" }) },
      { ...CTX, started: true, sourceUrl: null },
      ok,
    );
    expect(stopped.context).toBe("playbackStopped");

    const probeServers = vi.fn(async () => "ok" as const);
    const local = await diagnosePlaybackFailure({ from: "missingFile" }, { ...CTX, local: true, streamUrl: null, sourceUrl: null }, { probeServers });
    expect(local).toMatchObject({ cause: "offlineFileMissing", context: "offlinePlayback" });
    expect(probeServers).not.toHaveBeenCalled();
  });

  it("les détails ne portent jamais un jeton", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => answer(500)));
    const result = await diagnosePlaybackFailure(
      { from: "request", error: new Error("échec sur http://serveur/x?api_key=secret"), target: "jellyfin" },
      CTX,
      ok,
    );
    expect(JSON.stringify(result.details)).not.toContain("secret");
  });

  it("« Qualité réduite » : de la lecture directe à la conversion, puis palier par palier", () => {
    const presets = [
      { key: "original", bitrate: null }, { key: "quality1080p", bitrate: 8e6 }, { key: "quality720p", bitrate: 4e6 },
    ] as const;
    expect(lowerQualityTier(presets, "original")).toBe("quality1080p");
    expect(lowerQualityTier(presets, "quality1080p")).toBe("quality720p");
    expect(lowerQualityTier(presets, "quality720p")).toBeNull();
  });

  it("seul un défaut du lecteur justifie un lecteur de secours", () => {
    expect(isPlayerFault("decodeFailed")).toBe(true);
    expect(isPlayerFault("startTimeout")).toBe(true);
    expect(isPlayerFault("serverUnreachable")).toBe(false);
    expect(isPlayerFault("sessionExpired")).toBe(false);
    expect(isPlayerFault("fileMissing")).toBe(false);
  });
});
