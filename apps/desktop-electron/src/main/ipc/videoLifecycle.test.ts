/**
 * Le cycle de vie, sans mpv : ce qui se garde, c'est QUAND on gare et QUAND on
 * reprend — même montage, même options, dans le délai — et que tout autre cas
 * passe par l'arrêt d'avant.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  mpv: {
    running: true,
    commands: [] as string[][],
    reobserve: vi.fn(),
    destroy: vi.fn(),
  },
  stop: vi.fn(() => Promise.resolve()),
  session: { montage: "wayland" as string | null, windowing: "libre" as string | null },
}));

vi.mock("../video/mpv", () => ({
  command: (args: string[]) => {
    h.mpv.commands.push(args);
    return Promise.resolve(null);
  },
  destroy: h.mpv.destroy,
  isRunning: () => h.mpv.running,
  reobserve: h.mpv.reobserve,
}));
vi.mock("../video/mpvShutdown", () => ({ stop: h.stop }));
vi.mock("../linux/session", () => ({
  linuxMontage: () => h.session.montage,
  linuxWindowing: () => h.session.windowing,
}));

import { releasePlayer, rememberInit, reuseParked, stopPlayer } from "./videoLifecycle";

const OPTIONS = { vo: "gpu-next", hwdec: "nvdec", geometry: "2304x1600" };
const OBSERVED = [["pause", "flag"]] as const;
const realPlatform = process.platform;

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(process, "platform", { value: "linux", configurable: true });
  h.mpv.running = true;
  h.mpv.commands.length = 0;
  h.mpv.reobserve.mockClear();
  h.mpv.destroy.mockClear();
  h.stop.mockClear();
  h.session.montage = "wayland";
  h.session.windowing = "libre";
});

afterEach(async () => {
  // Vide un parking resté armé, sans laisser un arrêt en vol d'un test à l'autre.
  await stopPlayer();
  vi.useRealTimers();
  Object.defineProperty(process, "platform", { value: realPlatform, configurable: true });
});

describe("le parking entre deux épisodes", () => {
  it("gare au lieu d'arrêter, puis reprend avec les mêmes options — taille de naissance mise à part", async () => {
    rememberInit(OPTIONS, OBSERVED);
    await releasePlayer();
    expect(h.stop).not.toHaveBeenCalled();
    expect(h.mpv.commands).toEqual([["set", "force-window", "yes"], ["stop"]]);
    expect(reuseParked({ ...OPTIONS, geometry: "1920x1080" }, OBSERVED)).toBe(true);
    expect(h.mpv.reobserve).toHaveBeenCalledWith(OBSERVED);
  });

  it("des options différentes ne reprennent rien : l'appelant arrêtera", async () => {
    rememberInit(OPTIONS, OBSERVED);
    await releasePlayer();
    expect(reuseParked({ ...OPTIONS, hwdec: "no" }, OBSERVED)).toBe(false);
    expect(h.mpv.reobserve).not.toHaveBeenCalled();
  });

  it("le délai écoulé arrête pour de bon", async () => {
    rememberInit(OPTIONS, OBSERVED);
    await releasePlayer();
    await vi.advanceTimersByTimeAsync(3000);
    expect(h.stop).toHaveBeenCalledTimes(1);
    expect(reuseParked(OPTIONS, OBSERVED)).toBe(false);
  });

  it("hors du montage collé, mpv_destroy arrête comme avant", async () => {
    h.session.windowing = "plein-ecran";
    rememberInit(OPTIONS, OBSERVED);
    await releasePlayer();
    expect(h.stop).toHaveBeenCalledTimes(1);
    expect(h.mpv.commands).toEqual([]);
    expect(reuseParked(OPTIONS, OBSERVED)).toBe(false);
  });

  it("une instance jamais initialisée, ou déjà morte, n'est pas garée", async () => {
    await releasePlayer();
    expect(h.stop).toHaveBeenCalledTimes(1);
    h.stop.mockClear();
    rememberInit(OPTIONS, OBSERVED);
    h.mpv.running = false;
    await releasePlayer();
    expect(h.stop).toHaveBeenCalledTimes(1);
  });
});
