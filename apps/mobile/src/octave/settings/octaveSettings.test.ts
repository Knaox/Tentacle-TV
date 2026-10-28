import { beforeEach, describe, expect, it } from "vitest";
import type { StorageAdapter } from "@tentacle-tv/api-client";
import { configureOctaveSettings } from "./deviceSetting";
import { getCrossfadeMs, setCrossfadeMs } from "./crossfadeStore";
import { octaveAutoSync, octaveLiquidGlass, octaveSkipLaunchPin, octaveStartup, octaveTheme } from "./octaveSettings";

function memory(initial: Record<string, string> = {}): StorageAdapter & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

describe("Réglages d'Octave (mobile) — les défauts de Damien, jamais une réécriture", () => {
  beforeEach(() => configureOctaveSettings(memory()));

  it("un appareil neuf : transition douce à 3 s, tenue à jour et code PIN au démarrage allumés", () => {
    expect(getCrossfadeMs()).toBe(3_000);
    expect(octaveAutoSync.get()).toBe(true);
    expect(octaveSkipLaunchPin.get()).toBe(true);
    expect(octaveStartup.get()).toBe("last");
    expect(octaveTheme.get()).toBe("same");
    expect(octaveLiquidGlass.get()).toBe(true);
  });

  it("un choix déjà écrit (par le bureau, ou hier) reste le sien", () => {
    configureOctaveSettings(memory({
      tentacle_octave_crossfade: "0",
      tentacle_octave_offline_autosync: "0",
      tentacle_octave_skip_launch_pin: "0",
      tentacle_octave_startup: "octave",
      tentacle_octave_theme: "light",
      tentacle_liquid_glass: "false",
    }));
    expect(getCrossfadeMs()).toBe(0);
    expect(octaveAutoSync.get()).toBe(false);
    expect(octaveSkipLaunchPin.get()).toBe(false);
    expect(octaveStartup.get()).toBe("octave");
    expect(octaveTheme.get()).toBe("light");
    // Liquid Glass d'Octave absent : la valeur de Tentacle.
    expect(octaveLiquidGlass.get()).toBe(false);
  });

  it("écrit seulement l'écart au défaut, et notifie", () => {
    const store = memory();
    configureOctaveSettings(store);
    let calls = 0;
    const off = octaveSkipLaunchPin.subscribe(() => calls++);
    octaveSkipLaunchPin.set(false);
    expect(store.data.get("tentacle_octave_skip_launch_pin")).toBe("0");
    octaveSkipLaunchPin.set(true);
    expect(store.data.has("tentacle_octave_skip_launch_pin")).toBe(false);
    expect(calls).toBe(2);
    off();
    setCrossfadeMs(6_400);
    expect(store.data.get("tentacle_octave_crossfade")).toBe("6000");
    setCrossfadeMs(0);
    expect(getCrossfadeMs()).toBe(0);
  });
});
