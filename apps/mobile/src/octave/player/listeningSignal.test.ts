import { describe, expect, it } from "vitest";
import type { PlayerPhase } from "@tentacle-tv/shared/octave";
import { listeningSignal } from "./listeningSignal";

const view = (phase: PlayerPhase, fromDevice = false) => ({ phase, fromDevice });

describe("l'écoute d'Octave vue par la sonde de connectivité", () => {
  it("le son avance : la sonde périodique peut se taire", () => {
    expect(listeningSignal(view("starting"), view("playing"))).toEqual({ playing: true, suspect: false });
  });

  it("pause, chargement, fin, rien : la sonde reprend son rythme, sans rien suspecter", () => {
    for (const phase of ["paused", "starting", "ended", "idle"] as const) {
      expect(listeningSignal(view("playing"), view(phase))).toEqual({ playing: false, suspect: false });
    }
  });

  it("le son attend ses données ou échoue sur une source du serveur : sonde tout de suite", () => {
    expect(listeningSignal(view("playing"), view("stalled"))).toEqual({ playing: false, suspect: true });
    expect(listeningSignal(view("starting"), view("error"))).toEqual({ playing: false, suspect: true });
    expect(listeningSignal(null, view("error"))).toEqual({ playing: false, suspect: true });
  });

  it("une seule fois par entrée dans l'attente ou l'échec (l'instantané change souvent)", () => {
    expect(listeningSignal(view("stalled"), view("stalled")).suspect).toBe(false);
    expect(listeningSignal(view("error"), view("error")).suspect).toBe(false);
    // Puis de l'attente à l'échec : c'est un autre signe.
    expect(listeningSignal(view("stalled"), view("error")).suspect).toBe(true);
  });

  it("une copie gardée sur le téléphone qui échoue n'accuse pas le réseau", () => {
    expect(listeningSignal(view("playing", true), view("error", true))).toEqual({ playing: false, suspect: false });
    expect(listeningSignal(view("playing", true), view("playing", true)).playing).toBe(true);
  });
});
