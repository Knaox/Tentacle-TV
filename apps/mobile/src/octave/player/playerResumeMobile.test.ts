import { beforeEach, describe, expect, it, vi } from "vitest";

/** Le lancement du mobile : dit par le module natif (processus, balayages Android), sinon ce moteur JS. */

const native = vi.hoisted(() => ({ launch: null as string | null }));
vi.mock("react-native", () => ({ AppState: { addEventListener: () => ({ remove: () => undefined }) } }));
vi.mock("../../../modules/octave-audio", () => ({ octaveAudioLaunchId: () => native.launch }));

import { mobileLaunchId, mobileResumeDeps } from "./playerResumeMobile";

const storage = { getItem: () => null, setItem: () => undefined };

describe("reprise du lecteur (mobile) : le lancement", () => {
  beforeEach(() => {
    native.launch = null;
  });

  it("suit le module natif : un balayage (nouveau lancement natif) change le lancement, même JS vivant", () => {
    native.launch = "p1-0";
    expect(mobileLaunchId()).toBe("p1-0");
    native.launch = "p1-1";
    expect(mobileLaunchId()).toBe("p1-1");
    expect(mobileResumeDeps(storage, "https://srv").launchId?.()).toBe("p1-1");
  });

  it("sans module récent : stable pour ce moteur JS", () => {
    const first = mobileLaunchId();
    expect(first.startsWith("js-")).toBe(true);
    expect(mobileLaunchId()).toBe(first);
  });
});
