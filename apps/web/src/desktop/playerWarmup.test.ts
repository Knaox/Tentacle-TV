import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  platform: "linux" as string,
  mpv: true,
  fallback: false,
  debugOff: false,
  invoke: vi.fn(() => Promise.resolve("préchauffée")),
}));

vi.mock("./bridge", () => ({
  desktopPlatform: () => h.platform,
  supportsMpv: () => h.mpv,
  invoke: h.invoke,
}));
vi.mock("../lib/fallbackPlayer", () => ({ isFallbackActive: () => h.fallback }));
vi.mock("../lib/nativePlayer", () => ({ mpvDisabledByDebug: () => h.debugOff }));
vi.mock("../hooks/mpvRuntime", () => ({
  buildMpvInitOptions: () => ({ vo: "gpu-next" }),
  OBSERVED_PROPERTIES: [["pause", "flag"]],
}));

import { playerWarmupWanted, warmUpPlayer } from "./playerWarmup";

/** Chaque test part d'un instant qui dépasse l'anti-rafale du précédent. */
let clock = 0;
const later = (): number => (clock += 60_000);

beforeEach(() => {
  h.platform = "linux";
  h.mpv = true;
  h.fallback = false;
  h.debugOff = false;
  h.invoke.mockClear();
});

describe("le préchauffage du lecteur natif", () => {
  it("envoie à la coquille les options mêmes du lecteur", async () => {
    warmUpPlayer(later());
    await vi.waitFor(() => expect(h.invoke).toHaveBeenCalledTimes(1));
    expect(h.invoke).toHaveBeenCalledWith("mpv_prewarm", {
      options: { initialOptions: { vo: "gpu-next" }, observedProperties: [["pause", "flag"]] },
    });
  });

  it("une seule demande par rafale", async () => {
    const t = later();
    warmUpPlayer(t);
    warmUpPlayer(t + 1000);
    await vi.waitFor(() => expect(h.invoke).toHaveBeenCalledTimes(1));
    warmUpPlayer(t + 31_000);
    await vi.waitFor(() => expect(h.invoke).toHaveBeenCalledTimes(2));
  });

  it("rien là où le lecteur ouvert ne serait pas mpv", () => {
    for (const setup of [
      () => (h.platform = "windows"),
      () => (h.platform = "web"),
      () => (h.mpv = false),
      () => (h.fallback = true),
      () => (h.debugOff = true),
    ]) {
      h.platform = "linux";
      h.mpv = true;
      h.fallback = false;
      h.debugOff = false;
      setup();
      expect(playerWarmupWanted()).toBe(false);
      warmUpPlayer(later());
    }
    expect(h.invoke).not.toHaveBeenCalled();
  });

  it("un refus de la coquille ne remonte jamais", async () => {
    h.invoke.mockRejectedValueOnce(new Error("commande inconnue"));
    expect(() => warmUpPlayer(later())).not.toThrow();
    await vi.waitFor(() => expect(h.invoke).toHaveBeenCalledTimes(1));
  });
});
