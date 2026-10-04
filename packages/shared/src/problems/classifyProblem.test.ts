import { describe, expect, it } from "vitest";
import { classifyProblem, kindFromText } from "./classifyProblem";

/**
 * D'un échec brut à une cause : l'ordre (fichier local, constat de l'app,
 * appareil hors ligne, verdict de Jellyfin, statut HTTP, nature de l'échec),
 * et le sens d'un même statut selon ce qu'on joignait.
 */
describe("la cause d'un échec", () => {
  it("un fichier gardé sur l'appareil : absent ou abîmé, rien du réseau", () => {
    expect(classifyProblem({ local: true, message: "ENOENT: no such file", status: 500 })).toBe("offlineFileMissing");
    expect(classifyProblem({ local: true, kind: "decode" })).toBe("decodeFailed");
    expect(classifyProblem({ local: true, message: "loading failed" })).toBe("offlineFileDamaged");
  });

  it("ce que l'app a constaté prime ; hors ligne, un démarrage qui tarde est le réseau de l'appareil", () => {
    expect(classifyProblem({ marker: "startTimeout" })).toBe("startTimeout");
    expect(classifyProblem({ marker: "startTimeout", deviceOffline: true })).toBe("deviceOffline");
    // Le délai est un symptôme : le flux sondé (404) ou le serveur muet le disent mieux.
    expect(classifyProblem({ marker: "startTimeout", status: 404, target: "stream" })).toBe("fileMissing");
    expect(classifyProblem({ marker: "startTimeout", reachability: "jellyfin" })).toBe("jellyfinUnreachable");
    expect(classifyProblem({ marker: "startTimeout", reachability: "ok", streamAnswered: true, transcoding: true })).toBe("startTimeout");
    // Direct, le flux répond mais n'arrive pas à temps : la connexion ne suit pas.
    expect(classifyProblem({ marker: "startTimeout", reachability: "ok", streamAnswered: true })).toBe("bandwidthTooLow");
    // Un saut pendant une conversion qui ne ramène rien : même symptôme, sondé d'abord.
    expect(classifyProblem({ marker: "seekTimeout", reachability: "ok", streamAnswered: true, transcoding: true, started: true }))
      .toBe("seekTimeout");
    expect(classifyProblem({ marker: "seekTimeout", reachability: "jellyfin" })).toBe("jellyfinUnreachable");
    expect(classifyProblem({ marker: "engineFailed", status: 500 })).toBe("engineFailed");
    expect(classifyProblem({ marker: "subtitleBurn" })).toBe("subtitleBurnFailed");
    expect(classifyProblem({ marker: "bandwidth" })).toBe("bandwidthTooLow");
    expect(classifyProblem({ marker: "noMediaSource" })).toBe("fileMissing");
  });

  it("l'appareil hors ligne passe avant le statut", () => {
    expect(classifyProblem({ deviceOffline: true, message: "Network request failed" })).toBe("deviceOffline");
  });

  it("le verdict de PlaybackInfo : refus, format sans conversion possible ou interdite, trop de lectures", () => {
    expect(classifyProblem({ jellyfinErrorCode: "NotAllowed" })).toBe("notAllowed");
    expect(classifyProblem({ jellyfinErrorCode: "NoCompatibleStream" })).toBe("noCompatibleStream");
    expect(classifyProblem({ jellyfinErrorCode: "NoCompatibleStream", transcodeAllowed: false })).toBe("transcodeNotAllowed");
    expect(classifyProblem({ jellyfinErrorCode: "RateLimitExceeded" })).toBe("tooManyStreams");
  });

  it("401, 403 : la session, les droits — quel que soit ce qu'on joignait", () => {
    for (const target of ["tentacle", "jellyfin", "stream"] as const) {
      expect(classifyProblem({ status: 401, target })).toBe("sessionExpired");
      expect(classifyProblem({ status: 403, target })).toBe("notAllowed");
    }
  });

  it("un 404 dit autre chose selon ce qu'on joignait", () => {
    expect(classifyProblem({ status: 404, target: "health" })).toBe("notTentacle");
    expect(classifyProblem({ status: 404, target: "jellyfin" })).toBe("itemNotFound");
    expect(classifyProblem({ status: 404, target: "stream" })).toBe("fileMissing");
    expect(classifyProblem({ status: 404, target: "stream", transcoding: true })).toBe("transcodeFailed");
    expect(classifyProblem({ status: 404, target: "extension" })).toBe("extensionMissing");
    expect(classifyProblem({ status: 404, target: "tentacle" })).toBe("serverTooOld");
    expect(classifyProblem({ status: 404 })).toBe("serverTooOld");
  });

  it("un 5xx : la conversion (et ses sous-titres incrustés), Jellyfin, ou le serveur", () => {
    expect(classifyProblem({ status: 500, target: "stream", transcoding: true })).toBe("transcodeFailed");
    expect(classifyProblem({ status: 500, target: "stream", transcoding: true, burningSubtitles: true })).toBe("subtitleBurnFailed");
    expect(classifyProblem({ status: 500, target: "stream" })).toBe("jellyfinError");
    expect(classifyProblem({ status: 500, target: "jellyfin" })).toBe("jellyfinError");
    expect(classifyProblem({ status: 500, target: "tentacle" })).toBe("serverError");
  });

  it("502-504 : le relais ne joint plus Jellyfin, ou le mandataire ne joint plus le serveur", () => {
    expect(classifyProblem({ status: 502, target: "jellyfin" })).toBe("jellyfinUnreachable");
    expect(classifyProblem({ status: 504, target: "stream" })).toBe("jellyfinUnreachable");
    expect(classifyProblem({ status: 503, target: "tentacle" })).toBe("serverUnreachable");
    expect(classifyProblem({ status: 502, target: "health" })).toBe("serverUnreachable");
  });

  it("408 et 429", () => {
    expect(classifyProblem({ status: 408 })).toBe("serverTimeout");
    expect(classifyProblem({ status: 429, target: "stream" })).toBe("tooManyStreams");
    expect(classifyProblem({ status: 429, target: "tentacle" })).toBe("serverError");
  });

  it("sans statut, la nature de l'échec ; une fois la lecture partie, c'est la connexion perdue", () => {
    expect(classifyProblem({ message: "Network request failed" })).toBe("serverUnreachable");
    expect(classifyProblem({ message: "TypeError: Failed to fetch", target: "jellyfin" })).toBe("jellyfinUnreachable");
    expect(classifyProblem({ message: "Network request failed", started: true })).toBe("connectionLost");
    expect(classifyProblem({ name: "AbortError" })).toBe("serverTimeout");
    expect(classifyProblem({ kind: "timeout", started: true })).toBe("connectionLost");
    expect(classifyProblem({ message: "The certificate for this server is invalid" })).toBe("certificate");
    expect(classifyProblem({ message: "CLEARTEXT communication to 192.168.1.2 not permitted by network security policy" })).toBe("insecureBlocked");
    expect(classifyProblem({ kind: "decode", transcoding: true })).toBe("decodeFailed");
    expect(classifyProblem({ kind: "decode", transcodeAllowed: false })).toBe("transcodeNotAllowed");
    expect(classifyProblem({ kind: "notFound", target: "stream" })).toBe("fileMissing");
    expect(classifyProblem({ kind: "engine" })).toBe("engineFailed");
    expect(classifyProblem({ kind: "aborted" })).toBe("unknown");
    expect(classifyProblem({ message: "quelque chose d'imprévu" })).toBe("unknown");
    expect(classifyProblem({})).toBe("unknown");
  });

  it("lit la nature d'un échec dans son message", () => {
    expect(kindFromText("The Internet connection appears to be offline.")).toBe("network");
    expect(kindFromText("java.net.SocketTimeoutException: timeout")).toBe("timeout");
    expect(kindFromText("javax.net.ssl.SSLHandshakeException: Trust anchor for certification path not found.")).toBe("tls");
    expect(kindFromText("App Transport Security policy requires the use of a secure connection")).toBe("cleartext");
    expect(kindFromText("rien de connu")).toBeUndefined();
    expect(kindFromText(undefined, "TimeoutError")).toBe("timeout");
  });
});
