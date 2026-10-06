import { beforeEach, describe, expect, it, vi } from "vitest";
import type { JellyfinClient } from "../jellyfin";

/**
 * L'épisode suivant ne joue jamais sur la mesure du précédent : il la refait,
 * l'attend un peu, et retombe sur l'ancienne si elle tarde.
 */

let cached: number | null = 5_000_000;
let remeasure: () => Promise<number | null> = async () => 40_000_000;
const remeasureCalls = vi.fn();

vi.mock("./bitrateMeasure", () => ({
  cachedBitrate: () => cached,
  remeasureBitrate: () => { remeasureCalls(); return remeasure(); },
}));

const client = {} as JellyfinClient;

beforeEach(async () => {
  const { resetItemBitrateForTests } = await import("./itemBitrate");
  resetItemBitrateForTests();
  cached = 5_000_000;
  remeasure = async () => 40_000_000;
  remeasureCalls.mockClear();
});

describe("bitrateForItem", () => {
  it("le premier titre prend la mesure de l'accueil, sans attendre ni remesurer", async () => {
    const { bitrateForItem, bitratePendingFor } = await import("./itemBitrate");
    expect(bitratePendingFor("ep1")).toBe(false);
    await expect(bitrateForItem(client, "ep1")).resolves.toBe(5_000_000);
    expect(remeasureCalls).not.toHaveBeenCalled();
  });

  it("l'épisode suivant refait la mesure — et peut revenir en lecture directe", async () => {
    const { bitrateForItem, bitratePendingFor } = await import("./itemBitrate");
    await bitrateForItem(client, "ep1");
    expect(bitratePendingFor("ep2")).toBe(true);
    await expect(bitrateForItem(client, "ep2")).resolves.toBe(40_000_000);
    expect(remeasureCalls).toHaveBeenCalledTimes(1);
    expect(bitratePendingFor("ep2")).toBe(false);
  });

  it("le même titre relu garde sa mesure", async () => {
    const { bitrateForItem } = await import("./itemBitrate");
    await bitrateForItem(client, "ep1");
    await bitrateForItem(client, "ep1");
    expect(remeasureCalls).not.toHaveBeenCalled();
  });

  it("une remesure trop lente : l'ancienne mesure sert de repli, sans bloquer", async () => {
    const { bitrateForItem } = await import("./itemBitrate");
    await bitrateForItem(client, "ep1");
    remeasure = () => new Promise(() => {});
    await expect(bitrateForItem(client, "ep2", {}, 20)).resolves.toBe(5_000_000);
  });

  it("une remesure en échec : l'ancienne mesure, jamais « aucune »", async () => {
    const { bitrateForItem } = await import("./itemBitrate");
    await bitrateForItem(client, "ep1");
    remeasure = async () => null;
    await expect(bitrateForItem(client, "ep2")).resolves.toBe(5_000_000);
  });
});
