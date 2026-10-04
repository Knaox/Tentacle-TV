import { describe, expect, it } from "vitest";
import { TVOS_BINDINGS } from "../remote/bindings/tvos";
import type { RemoteIntent } from "../remote/intents";
import { playerRemoteSteps, scrubDirOf } from "./playerRemote";

const tvos = (intent: RemoteIntent) => playerRemoteSteps(intent, TVOS_BINDINGS.traits).map((s) => ("dir" in s ? `${s.kind}:${s.dir}` : s.kind));

describe("la table intention → gestes du lecteur (Siri Remote)", () => {
  it("chaque appui est un relâchement d'abord (tvOS n'annonce qu'au relâchement)", () => {
    expect(tvos({ type: "move", direction: "droite" })).toEqual(["release", "arrow:forward", "anyPress"]);
    expect(tvos({ type: "move", direction: "gauche" })).toEqual(["release", "arrow:backward", "anyPress"]);
    expect(tvos({ type: "move", direction: "haut" })).toEqual(["release", "vertical", "anyPress"]);
    expect(tvos({ type: "move", direction: "bas" })).toEqual(["release", "vertical", "anyPress"]);
    expect(tvos({ type: "select" })).toEqual(["release", "select", "anyPress"]);
    expect(tvos({ type: "playPause" })).toEqual(["release", "playPause"]);
    expect(tvos({ type: "page", direction: "haut" })).toEqual(["release"]);
  });

  it("le maintien de ←/→ ouvre l'avance rapide ; sa fin — ou « Changed » — relâche", () => {
    expect(tvos({ type: "hold", key: "droite", phase: "start" })).toEqual(["arrowHold:forward"]);
    expect(tvos({ type: "hold", key: "gauche", phase: "start" })).toEqual(["arrowHold:backward"]);
    expect(tvos({ type: "hold", key: "droite", phase: "update" })).toEqual(["release"]);
    expect(tvos({ type: "hold", key: "gauche", phase: "end" })).toEqual(["release"]);
  });

  it("les autres maintiens ne font que relâcher à leur fin", () => {
    for (const key of ["select", "playPause", "haut", "bas"] as const) {
      expect(tvos({ type: "hold", key, phase: "start" })).toEqual([]);
      expect(tvos({ type: "hold", key, phase: "update" })).toEqual([]);
      expect(tvos({ type: "hold", key, phase: "end" })).toEqual(["release"]);
    }
  });

  it("Retour, glisser rapide et glisser continu ne sont pas des gestes du lecteur", () => {
    expect(tvos({ type: "retour" })).toEqual([]);
    expect(tvos({ type: "swipe", direction: "droite" })).toEqual([]);
    expect(tvos({ type: "drag", phase: "move", x: 10, y: 0, vx: 1, vy: 0 })).toEqual([]);
  });

  it("les touches de transport (Android TV, LG) : avance et recul défilent", () => {
    expect(tvos({ type: "transport", command: "avance" })).toEqual(["mediaSeek:forward", "anyPress"]);
    expect(tvos({ type: "transport", command: "retour" })).toEqual(["mediaSeek:backward", "anyPress"]);
    expect(tvos({ type: "transport", command: "lecture" })).toEqual([]);
  });

  it("le relâchement d'Avance ou de Retour rapides relâche le maintien (Android TV)", () => {
    const steps = (command: "avance" | "retour", phase: "down" | "up") =>
      playerRemoteSteps({ type: "transport", command }, { pressOnRelease: true }, phase).map((s) => s.kind);
    expect(steps("avance", "down")).toEqual(["mediaSeek", "anyPress"]);
    expect(steps("avance", "up")).toEqual(["release"]);
    expect(steps("retour", "up")).toEqual(["release"]);
  });

  it("sans annonce au relâchement, aucun relâchement implicite", () => {
    const steps = playerRemoteSteps({ type: "move", direction: "droite" }, { pressOnRelease: false }).map((s) => s.kind);
    expect(steps).toEqual(["arrow", "anyPress"]);
  });

  it("seules gauche et droite sont des sens de la vidéo", () => {
    expect(scrubDirOf("droite")).toBe("forward");
    expect(scrubDirOf("gauche")).toBe("backward");
    expect(scrubDirOf("haut")).toBeNull();
  });
});
