import { describe, expect, it } from "vitest";
import { classifyProblem } from "@tentacle-tv/shared";
import { desktopPlaybackReport } from "./playbackFailure";

/**
 * L'échec de mpv, dans la forme commune : le chien de garde est une attente
 * dépassée, la fin de fichier en erreur garde le message de mpv et son code.
 */
describe("échec du lecteur de bureau", () => {
  it("le flux qui ne démarre pas est une attente dépassée", () => {
    expect(desktopPlaybackReport({ kind: "player", messageKey: "player:streamStartFailed" })).toEqual({ from: "marker", marker: "startTimeout" });
  });

  it("une fin de fichier en erreur garde le message de mpv, que la sonde départagera", () => {
    const report = desktopPlaybackReport({ kind: "player", detail: "end-file (error=-13)" });
    expect(report).toMatchObject({ from: "engine", failure: { engine: "mpv", message: "loading failed", code: "-13" } });
    const format = desktopPlaybackReport({ kind: "player", detail: "end-file (error=-17)" });
    if (format.from !== "engine") throw new Error("moteur attendu");
    // Format refusé, flux qui répond : le lecteur est en cause (la bascule web a sa chance).
    expect(classifyProblem({ kind: format.failure.kind, target: "stream", streamAnswered: true })).toBe("decodeFailed");
  });
});
