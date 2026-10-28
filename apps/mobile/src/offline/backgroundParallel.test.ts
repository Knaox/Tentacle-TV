import { beforeEach, describe, expect, it, vi } from "vitest";

const platform = vi.hoisted(() => ({ OS: "ios" }));
vi.mock("react-native", () => ({ Platform: platform }));
vi.mock("@tentacle-tv/offline-core", () => ({ MAX_PARALLEL: 1 }));

const { setTransfersSuspended, transferMusicParallelLimit, transferParallelLimit } = await import("./backgroundParallel");

describe("places des transferts", () => {
  beforeEach(() => {
    platform.OS = "ios";
    setTransfersSuspended(false);
  });

  it("au premier plan : un film, trois titres d'Octave", () => {
    expect(transferParallelLimit()).toBe(1);
    expect(transferMusicParallelLimit()).toBe(3);
  });

  it("iPhone qui passe derrière : trois films remis au système, et toujours trois titres (la file du serveur les fait attendre)", () => {
    setTransfersSuspended(true);
    expect(transferParallelLimit()).toBe(3);
    expect(transferMusicParallelLimit()).toBe(3);
  });

  it("Android : le service garde le JavaScript vivant, aucune place de plus", () => {
    platform.OS = "android";
    setTransfersSuspended(true);
    expect(transferParallelLimit()).toBe(1);
    expect(transferMusicParallelLimit()).toBe(3);
  });
});
