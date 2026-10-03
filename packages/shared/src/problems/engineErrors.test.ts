import { describe, expect, it } from "vitest";
import { classifyProblem } from "./classifyProblem";
import {
  avPlayerFailure, exoCodeOf, exoPlayerFailure, hlsFailure, mediaElementFailure, mpvFailure, nativeVideoFailure, statusFromText,
} from "./engineErrors";

/**
 * Chaque moteur, dans son vocabulaire, rendu dans celui du modèle : statut
 * deviné, nature de l'échec, moteur et code pour « Détails » — et la cause
 * qui en sort, flux en lecture directe ou converti.
 */
const cause = (failure: { status?: number; kind?: ReturnType<typeof mpvFailure>["kind"] }, extra = {}) =>
  classifyProblem({ status: failure.status, kind: failure.kind, target: "stream", ...extra });

describe("erreurs des moteurs", () => {
  it("lit un statut HTTP dans un message", () => {
    expect(statusFromText("http: HTTP error 404 Not Found")).toBe(404);
    expect(statusFromText("Response code: 500")).toBe(500);
    expect(statusFromText("403 Forbidden")).toBe(403);
    expect(statusFromText("HTTP 401: Unauthorized")).toBe(401);
    expect(statusFromText("loading failed")).toBeUndefined();
    expect(statusFromText(undefined)).toBeUndefined();
  });

  it("mpv : format illisible, rendu impossible, et « loading failed » qui ne dit rien", () => {
    expect(mpvFailure("unrecognized file format")).toMatchObject({ kind: "decode", engine: "mpv" });
    expect(mpvFailure("no audio or video data played").kind).toBe("decode");
    expect(mpvFailure("video output initialization failed").kind).toBe("engine");
    expect(mpvFailure("démarrage du rendu impossible : Metal").kind).toBe("engine");
    expect(mpvFailure("loading failed")).toEqual({ status: undefined, kind: undefined, engine: "mpv", message: "loading failed" });
    expect(cause(mpvFailure("unrecognized file format"), { transcoding: true })).toBe("decodeFailed");
    expect(cause(mpvFailure("video output initialization failed"))).toBe("engineFailed");
  });

  it("AVPlayer : réseau, certificat, refus HTTP enfouis dans un -11800, format", () => {
    expect(avPlayerFailure({ code: -1009, domain: "NSURLErrorDomain", localizedDescription: "The Internet connection appears to be offline." }))
      .toMatchObject({ kind: "network", code: "NSURLErrorDomain -1009" });
    expect(avPlayerFailure({ code: -1202, domain: "NSURLErrorDomain" }).kind).toBe("tls");
    expect(avPlayerFailure({ code: -1022, domain: "NSURLErrorDomain" }).kind).toBe("cleartext");
    const missing = avPlayerFailure({ code: -11800, domain: "AVFoundationErrorDomain", localizedFailureReason: "An unknown error occurred (-12938)" });
    expect(missing.status).toBe(404);
    expect(cause(missing)).toBe("fileMissing");
    expect(avPlayerFailure({ code: -12660, domain: "CoreMediaErrorDomain" }).status).toBe(403);
    expect(avPlayerFailure({ code: -11828, domain: "AVFoundationErrorDomain", localizedDescription: "Cannot Open" }).kind).toBe("decode");
    expect(avPlayerFailure({ code: -12889, domain: "CoreMediaErrorDomain" }).kind).toBe("timeout");
    expect(avPlayerFailure({ error: "The operation could not be completed" }).kind).toBeUndefined();
  });

  it("ExoPlayer : codes préfixés par react-native-video, noms, et « Response code »", () => {
    expect(exoCodeOf("22001")).toBe(2001);
    expect(exoCodeOf("4005")).toBe(4005);
    expect(exoCodeOf("abc")).toBeUndefined();
    expect(exoPlayerFailure({ errorCode: "22001", errorString: "ExoPlaybackException: ERROR_CODE_IO_NETWORK_CONNECTION_FAILED" }).kind).toBe("network");
    expect(exoPlayerFailure({ errorCode: "22002" }).kind).toBe("timeout");
    expect(exoPlayerFailure({ errorCode: "22007" }).kind).toBe("cleartext");
    expect(exoPlayerFailure({ errorCode: "24003" }).kind).toBe("decode");
    const bad = exoPlayerFailure({
      errorCode: "22004", errorString: "ExoPlaybackException: ERROR_CODE_IO_BAD_HTTP_STATUS",
      errorException: "androidx.media3.datasource.HttpDataSource$InvalidResponseCodeException: Response code: 401",
    });
    expect(bad.status).toBe(401);
    expect(cause(bad)).toBe("sessionExpired");
    expect(exoPlayerFailure({ errorString: "ExoPlaybackException: ERROR_CODE_IO_FILE_NOT_FOUND" }).kind).toBe("notFound");
  });

  it("react-native-video : la forme d'Android ou celle d'iOS, enveloppe `error` comprise", () => {
    expect(nativeVideoFailure({ error: { errorCode: "22001", errorString: "x" } }).engine).toBe("ExoPlayer");
    expect(nativeVideoFailure({ error: { code: -1009, domain: "NSURLErrorDomain" } })).toMatchObject({ engine: "AVPlayer", kind: "network" });
    expect(nativeVideoFailure({ code: -1001, domain: "NSURLErrorDomain" }).kind).toBe("timeout");
    expect(nativeVideoFailure("rien").engine).toBe("AVPlayer");
  });

  it("hls.js : statut de la réponse, délais, réseau sans réponse, média", () => {
    const manifest = hlsFailure({ type: "networkError", details: "manifestLoadError", response: { code: 404 } });
    expect(manifest).toMatchObject({ status: 404, engine: "hls.js", code: "manifestLoadError" });
    expect(cause(manifest, { transcoding: true })).toBe("transcodeFailed");
    expect(hlsFailure({ type: "networkError", details: "fragLoadTimeOut" }).kind).toBe("timeout");
    expect(hlsFailure({ type: "networkError", details: "manifestLoadError", response: { code: 0 } }).kind).toBe("network");
    expect(hlsFailure({ type: "mediaError", details: "bufferAppendError" }).kind).toBe("decode");
    expect(cause(hlsFailure({ type: "networkError", details: "fragLoadError", response: { code: 500 } }), { transcoding: true, burningSubtitles: true }))
      .toBe("subtitleBurnFailed");
  });

  it("<video> : MediaError, la source refusée restant ambiguë", () => {
    expect(mediaElementFailure(3, "PIPELINE_ERROR_DECODE")).toMatchObject({ kind: "decode", code: "MEDIA_ERR_DECODE" });
    expect(mediaElementFailure(2).kind).toBe("network");
    expect(mediaElementFailure(1).kind).toBe("aborted");
    expect(mediaElementFailure(4, "MEDIA_ELEMENT_ERROR: Format error")).toMatchObject({ kind: undefined, code: "MEDIA_ERR_SRC_NOT_SUPPORTED" });
  });
});
