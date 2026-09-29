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
    cadence: [] as string[],
    // L'identité de l'instance vivante : l'expiration ne touche qu'à celle qu'elle a garée.
    handle: { id: 1 } as object,
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
  setPumpCadence: (mode: string) => h.mpv.cadence.push(mode),
  handle: () => (h.mpv.running ? h.mpv.handle : null),
  reobserve: h.mpv.reobserve,
  // Sous Linux, l'écriture passe par la même file que les commandes : elle est
  // rangée dans la même liste, pour que l'ORDRE se vérifie.
  setProperty: (name: string, value: string) => {
    h.mpv.commands.push(["set", name, value]);
    return Promise.resolve(null);
  },
}));
vi.mock("../video/mpvShutdown", () => ({ stop: h.stop }));
vi.mock("../linux/session", () => ({
  linuxMontage: () => h.session.montage,
  linuxWindowing: () => h.session.windowing,
}));

import {
  configureParking,
  isParked,
  parkSlim,
  releasePlayer,
  rememberInit,
  reuseParked,
  serialized,
  stopPlayer,
} from "./videoLifecycle";

const power = { onBattery: false, recycle: vi.fn(() => Promise.resolve()) };
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
  h.mpv.cadence.length = 0;
  h.mpv.handle = { id: 1 };
  h.stop.mockClear();
  power.onBattery = false;
  power.recycle.mockClear();
  configureParking({ onBattery: () => power.onBattery, recycle: power.recycle });
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
    expect(h.mpv.commands).toEqual([["set", "force-window", "yes"], ["set", "title", ""], ["stop"]]);
    expect(reuseParked({ ...OPTIONS, geometry: "1920x1080" }, OBSERVED)).toBe(true);
    expect(h.mpv.reobserve).toHaveBeenCalledWith(OBSERVED);
  });

  it("le titre vidé AVANT l'arrêt, rétabli à la reprise — le signal d'Alt+Tab pour la colle", async () => {
    const titled = { ...OPTIONS, title: "Tentacle TV" };
    rememberInit(titled, OBSERVED);
    await releasePlayer();
    // Vide avant `stop` : l'idle avec force-window pousse le titre à la fenêtre.
    const commands = h.mpv.commands.map((c) => c.join(" "));
    expect(commands.indexOf("set title ")).toBeLessThan(commands.indexOf("stop"));
    h.mpv.commands.length = 0;
    expect(reuseParked(titled, OBSERVED)).toBe(true);
    expect(h.mpv.commands).toEqual([["set", "title", "Tentacle TV"]]);
  });

  it("des options différentes ne reprennent rien : l'appelant arrêtera", async () => {
    rememberInit(OPTIONS, OBSERVED);
    await releasePlayer();
    expect(reuseParked({ ...OPTIONS, hwdec: "no" }, OBSERVED)).toBe(false);
    expect(h.mpv.reobserve).not.toHaveBeenCalled();
  });

  it("sur batterie, le délai d'un épisode, puis l'arrêt pour de bon — sans recyclage", async () => {
    power.onBattery = true;
    rememberInit(OPTIONS, OBSERVED);
    await releasePlayer();
    await vi.advanceTimersByTimeAsync(2999);
    expect(h.stop).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(h.stop).toHaveBeenCalledTimes(1);
    expect(power.recycle).not.toHaveBeenCalled();
    expect(reuseParked(OPTIONS, OBSERVED)).toBe(false);
  });

  it("sur secteur, l'instance chaude attend une minute, puis cède la place à une mince", async () => {
    rememberInit(OPTIONS, OBSERVED);
    await releasePlayer();
    await vi.advanceTimersByTimeAsync(59_999);
    expect(h.stop).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(h.stop).toHaveBeenCalledTimes(1);
    expect(power.recycle).toHaveBeenCalledTimes(1);
  });

  it("l'expiration ne touche pas une instance qu'un mpv_init a mise à la place", async () => {
    rememberInit(OPTIONS, OBSERVED);
    await releasePlayer();
    // La minuterie tire pendant qu'un mpv_init tient la file ; quand vient son
    // tour, l'instance vivante n'est plus celle qui était garée.
    let release!: () => void;
    const busy = serialized(() => new Promise<void>((r) => (release = r)));
    await vi.advanceTimersByTimeAsync(60_000);
    h.mpv.handle = { id: 2 };
    release();
    await busy;
    await vi.advanceTimersByTimeAsync(0);
    expect(h.stop).not.toHaveBeenCalled();
    expect(power.recycle).not.toHaveBeenCalled();
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

  it("garée, la pompe ralentit ; reprise ou arrêtée, elle repart à la cadence de lecture", async () => {
    rememberInit(OPTIONS, OBSERVED);
    await releasePlayer();
    expect(h.mpv.cadence).toEqual(["parked"]);
    expect(reuseParked(OPTIONS, OBSERVED)).toBe(true);
    expect(h.mpv.cadence).toEqual(["parked", "active"]);
    await releasePlayer();
    await stopPlayer();
    // L'arrêt gracieux guette l'idle au rythme de la pompe : cadence rendue AVANT.
    expect(h.mpv.cadence.slice(-1)).toEqual(["active"]);
    expect(h.stop).toHaveBeenCalledTimes(1);
  });
});

describe("l'instance mince du préchauffage", () => {
  it("naît déjà garée : titre vide AVANT la sortie vidéo, sans expiration", async () => {
    rememberInit(OPTIONS, OBSERVED);
    expect(parkSlim()).toBe(true);
    // Le titre d'abord : la fenêtre naît « garée » pour la colle (Alt+Tab).
    expect(h.mpv.commands).toEqual([["set", "title", ""], ["set", "force-window", "yes"]]);
    expect(h.mpv.cadence).toEqual(["parked"]);
    await vi.advanceTimersByTimeAsync(24 * 3600_000);
    expect(h.stop).not.toHaveBeenCalled();
    expect(isParked()).toBe(true);
    expect(reuseParked({ ...OPTIONS, geometry: "1280x720" }, OBSERVED)).toBe(true);
  });

  it("rien sans montage collé, sans instance, ou sans options connues", () => {
    h.session.windowing = "plein-ecran";
    rememberInit(OPTIONS, OBSERVED);
    expect(parkSlim()).toBe(false);
    h.session.windowing = "libre";
    h.mpv.running = false;
    expect(parkSlim()).toBe(false);
    expect(h.mpv.commands).toEqual([]);
  });
});

describe("la file des gestes", () => {
  it("chaque geste attend le précédent, même en échec", async () => {
    const order: string[] = [];
    const a = serialized(async () => {
      await Promise.resolve();
      order.push("a");
      throw new Error("raté");
    });
    const b = serialized(async () => {
      order.push("b");
      return "ok";
    });
    await expect(a).rejects.toThrow("raté");
    await expect(b).resolves.toBe("ok");
    expect(order).toEqual(["a", "b"]);
  });
});
