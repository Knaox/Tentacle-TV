import { describe, expect, it } from "vitest";
import { pickDisplayMode, type DisplayModeInfo } from "./displayModeChoice";

const mode = (id: number, refreshRate: number, width = 1080, height = 2400): DisplayModeInfo => ({ id, width, height, refreshRate });
const PHONE_120 = [mode(1, 60), mode(2, 90), mode(3, 120)];
const PHONE_60 = [mode(1, 60)];
const TV = [mode(1, 60, 3840, 2160), mode(2, 50, 3840, 2160), mode(3, 23.976, 3840, 2160), mode(4, 24, 3840, 2160), mode(5, 60, 1920, 1080)];

describe("pickDisplayMode", () => {
  it("un film à 23,976 sur un écran 60/90/120 passe à 120 Hz (×5)", () => {
    expect(pickDisplayMode(23.976, 1, PHONE_120)?.id).toBe(3);
  });

  it("29,97 et 30 restent à 60 Hz, le plus petit multiple", () => {
    expect(pickDisplayMode(29.97, 3, PHONE_120)?.id).toBe(1);
    expect(pickDisplayMode(30, 1, PHONE_120)?.id).toBe(1);
  });

  it("60 i/s : 60 Hz exact", () => {
    expect(pickDisplayMode(59.94, 3, PHONE_120)?.id).toBe(1);
  });

  it("25 et 50 i/s sur un écran 60/90/120 : rien, jamais « le plus proche »", () => {
    expect(pickDisplayMode(25, 1, PHONE_120)).toBeNull();
    expect(pickDisplayMode(50, 1, PHONE_120)).toBeNull();
  });

  it("un écran à 60 Hz seul : 30 et 60 i/s restent, 24 ne change rien", () => {
    expect(pickDisplayMode(30, 1, PHONE_60)?.id).toBe(1);
    expect(pickDisplayMode(23.976, 1, PHONE_60)).toBeNull();
  });

  it("préfère l'exact le plus proche (23,976 plutôt que 24) et garde la définition", () => {
    expect(pickDisplayMode(23.976, 1, TV)?.id).toBe(3);
    expect(pickDisplayMode(24, 1, TV)?.id).toBe(4);
    expect(pickDisplayMode(25, 1, TV)?.id).toBe(2);
    expect(pickDisplayMode(23.976, 5, TV)).toBeNull();
  });

  it("refuse une cadence voisine mais différente (24 sur un panneau 25)", () => {
    expect(pickDisplayMode(24, 1, [mode(1, 25), mode(2, 50)])).toBeNull();
  });

  it("ne choisit rien sans mode courant connu ni cadence", () => {
    expect(pickDisplayMode(24, 99, PHONE_120)).toBeNull();
    expect(pickDisplayMode(0, 1, PHONE_120)).toBeNull();
    expect(pickDisplayMode(Number.NaN, 1, PHONE_120)).toBeNull();
  });
});
