import { describe, expect, it, vi } from "vitest";
import type { AudioEnginePort } from "@tentacle-tv/shared/music";
import { createFakeEngine } from "@tentacle-tv/shared/octave/testing";
import { adoptPrestartedEngine, PRESTART_ADOPT_MS, prestartAudioEngine } from "./enginePrestart";
import type { EnginePrefs } from "./mpv/mpvAudioEngine";

/** Le moteur démarré au geste de la bascule : repris par Octave, sinon arrêté seul. */

const PREFS: EnginePrefs = { volume: 1, muted: false, replayGain: "auto", deviceId: null, exclusive: false };

describe("démarrage au geste", () => {
  const auth = { baseUrl: "", token: "t", useCredentials: true };

  it("repris une fois par le fournisseur, pour la même session seulement", () => {
    const start = vi.fn(async () => createFakeEngine() as AudioEnginePort);
    prestartAudioEngine(auth, PREFS, start);
    prestartAudioEngine(auth, PREFS, start);
    expect(start).toHaveBeenCalledTimes(1);
    expect(adoptPrestartedEngine({ ...auth, token: "autre" })).toBeNull();
    expect(adoptPrestartedEngine(auth)).not.toBeNull();
    expect(adoptPrestartedEngine(auth)).toBeNull();
  });

  it("jamais repris : arrêté seul (aucun moteur qui tourne sans Octave à l'écran)", async () => {
    vi.useFakeTimers();
    const real = createFakeEngine();
    const dispose = vi.spyOn(real, "dispose");
    prestartAudioEngine(auth, PREFS, async () => real);
    await vi.advanceTimersByTimeAsync(PRESTART_ADOPT_MS);
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(adoptPrestartedEngine(auth)).toBeNull();
    vi.useRealTimers();
  });
});
