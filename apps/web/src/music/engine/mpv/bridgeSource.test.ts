/**
 * Ce que la page confie à la coquille pour une copie gardée : « ce titre, pour ce compte », et — titre qui a changé
 * d'identité depuis qu'il a été gardé — la clé sous laquelle la COPIE est gardée. Jamais un chemin.
 */

import { describe, expect, it, vi } from "vitest";
import type { PlaybackSource } from "@tentacle-tv/shared/music";

vi.mock("../../../desktop/bridge", () => ({ invoke: async () => undefined, listen: async () => () => undefined }));

import { bridgeSource } from "./mpvAudioEngine";

const source = (partial: Partial<PlaybackSource>): PlaybackSource => ({
  trackKey: "ext:sillon:imp:x", url: "/api/plugins/sillon/music/offline/imp%3Ax", origin: "plugin", complete: true, sizeBytes: 5,
  durationMs: 1000, format: null, replayGain: null, expiresAt: null, ...partial,
});

describe("bridgeSource — la copie gardée", () => {
  it("dit la clé de la copie, jamais un chemin", () => {
    const bridged = bridgeSource(source({ kept: { userId: "compte" } }), "http://serveur.test");
    expect(bridged.kept).toEqual({ userId: "compte", trackKey: "ext:sillon:imp:x" });
    expect(bridged.url).toBe("http://serveur.test/api/plugins/sillon/music/offline/imp%3Ax");
  });

  it("une source du serveur : rien de gardé", () => {
    expect(bridgeSource(source({}), "http://serveur.test").kept).toBeUndefined();
  });
});
