import { describe, expect, it } from "vitest";
import { classifyProblem } from "@tentacle-tv/shared";
import { collectFailure, nextVersionId, transcodeAllowedOf } from "./playbackFailure";

/**
 * Ce que le lecteur mobile sait d'un échec, dans la forme du modèle commun :
 * les deux moteurs, la négociation (statut gardé, transport), les constats de
 * l'app, le fichier local absent — et la cause qui en sort.
 */
describe("échecs du lecteur mobile", () => {
  it("mpv : le message de fin de fichier, moteur nommé dans les détails", () => {
    const { raw, facts } = collectFailure({ from: "engine", engine: "mpv", error: { message: "unrecognized file format" } });
    expect(raw).toMatchObject({ kind: "decode", target: "stream" });
    expect(facts).toMatchObject({ engine: "mpv", message: "unrecognized file format" });
    expect(classifyProblem({ ...raw, transcoding: true })).toBe("decodeFailed");
  });

  it("lecteur système : la forme de react-native-video, iOS comme Android", () => {
    const ios = collectFailure({ from: "engine", engine: "native", error: { error: { code: -1009, domain: "NSURLErrorDomain" } } });
    expect(ios.facts.engine).toBe("AVPlayer");
    expect(classifyProblem({ ...ios.raw, started: true })).toBe("connectionLost");
    const android = collectFailure({
      from: "engine", engine: "native",
      error: { error: { errorCode: "22004", errorString: "ExoPlaybackException: ERROR_CODE_IO_BAD_HTTP_STATUS", errorException: "Response code: 404" } },
    });
    expect(android.raw.status).toBe(404);
    expect(classifyProblem(android.raw)).toBe("fileMissing");
  });

  it("la négociation garde son statut ; une panne de transport accuse le relais du serveur", () => {
    const refused = collectFailure({ from: "request", error: Object.assign(new Error("Media server API error 401"), { status: 401 }), target: "jellyfin" });
    expect(classifyProblem(refused.raw)).toBe("sessionExpired");
    expect(refused.facts.status).toBe(401);
    const gone = collectFailure({ from: "request", error: Object.assign(new Error("x"), { status: 404 }), target: "jellyfin", request: "GET /Items/1" });
    expect(classifyProblem(gone.raw)).toBe("itemNotFound");
    expect(gone.facts.request).toBe("GET /Items/1");
    const down = collectFailure({ from: "request", error: new TypeError("Network request failed"), target: "tentacle" });
    expect(classifyProblem(down.raw)).toBe("serverUnreachable");
  });

  it("aucune source : le refus de Jellyfin s'il est donné, sinon le fichier manquant", () => {
    expect(classifyProblem(collectFailure({ from: "marker", marker: "noMediaSource", jellyfinErrorCode: "NotAllowed" }).raw)).toBe("notAllowed");
    expect(classifyProblem(collectFailure({ from: "marker", marker: "noMediaSource" }).raw)).toBe("fileMissing");
    expect(classifyProblem(collectFailure({ from: "marker", marker: "startTimeout" }).raw)).toBe("startTimeout");
  });

  it("le fichier gardé sur l'appareil n'y est plus", () => {
    expect(classifyProblem({ ...collectFailure({ from: "missingFile" }).raw, local: true })).toBe("offlineFileMissing");
  });

  it("lit le droit de faire convertir dans le profil gardé", () => {
    expect(transcodeAllowedOf('{"Policy":{"EnableVideoPlaybackTranscoding":false}}')).toBe(false);
    expect(transcodeAllowedOf('{"Policy":{}}')).toBeUndefined();
    expect(transcodeAllowedOf("pas du json")).toBeUndefined();
    expect(transcodeAllowedOf(null)).toBeUndefined();
  });

  it("« Autre version » : la suivante, en boucle, seulement s'il y en a plusieurs", () => {
    const sources = [{ Id: "a" }, { Id: "b" }, { Id: "c" }];
    expect(nextVersionId(sources, "a")).toBe("b");
    expect(nextVersionId(sources, "c")).toBe("a");
    expect(nextVersionId(sources, "inconnu")).toBe("a");
    expect(nextVersionId([{ Id: "a" }], "a")).toBeNull();
    expect(nextVersionId(undefined, "a")).toBeNull();
  });
});
