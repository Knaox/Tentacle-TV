import { describe, expect, it } from "vitest";
import { classifyProblem, collectPlaybackFailure, isPlayerFault } from "@tentacle-tv/shared";
import { desktopPlaybackReport, mpvInitFailure } from "./playbackFailure";

/**
 * L'échec de mpv, dans la forme commune : le chien de garde est une attente
 * dépassée, la fin de fichier en erreur garde le message de mpv et son code.
 */
describe("échec du lecteur de bureau", () => {
  it("le flux qui ne démarre pas est une attente dépassée", () => {
    expect(desktopPlaybackReport({ kind: "player", messageKey: "player:streamStartFailed" })).toEqual({ from: "marker", marker: "startTimeout" });
  });

  it("un saut pendant un transcodage qui ne ramène rien est son propre délai dépassé", () => {
    expect(desktopPlaybackReport({ kind: "player", messageKey: "errors:reasonSeekTimeout", started: true }))
      .toEqual({ from: "marker", marker: "seekTimeout" });
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

/**
 * Les échecs qui accusent le LECTEUR lui-même : le lecteur web prend le relais,
 * quoi que disent les sondes du réseau et du flux (mesuré le 11/11/2026 : ils
 * devenaient « serveur trop lent » ou « connexion perdue », sans bascule).
 */
describe("le moteur en panne bascule vers le lecteur web", () => {
  /** La cause que le diagnostic en tire, avec les pires sondes : flux injoignable, lecture commencée. */
  const causeOf = (failure: Parameters<typeof desktopPlaybackReport>[0]) => {
    const { raw } = collectPlaybackFailure(desktopPlaybackReport(failure));
    return classifyProblem({ ...raw, kind: raw.kind ?? "network", started: failure.started, reachability: "ok" });
  };

  it("mpv_init resté sans réponse : le lecteur, jamais « le serveur met trop de temps »", () => {
    const failure = mpvInitFailure(new Error("mpv-init-timeout"));
    expect(desktopPlaybackReport(failure)).toEqual({ from: "marker", marker: "engineFailed" });
    expect(isPlayerFault(causeOf(failure))).toBe(true);
  });

  it("mpv_init refusé par la coquille : le lecteur aussi", () => {
    expect(isPlayerFault(causeOf(mpvInitFailure(new Error("mpv_init : libmpv introuvable"))))).toBe(true);
  });

  it("une chute de mpv en pleine lecture (sorties impossibles, erreur générique) : le lecteur, pas « connexion perdue »", () => {
    for (const code of [-2, -3, -14, -15, -20]) {
      expect(isPlayerFault(causeOf({ kind: "player", detail: `end-file (error=${code})`, started: true }))).toBe(true);
    }
  });

  it("un chargement raté ou un format refusé restent départagés par les sondes", () => {
    expect(desktopPlaybackReport({ kind: "player", detail: "end-file (error=-13)", started: true }).from).toBe("engine");
    expect(causeOf({ kind: "player", detail: "end-file (error=-13)", started: true })).toBe("connectionLost");
  });
});
