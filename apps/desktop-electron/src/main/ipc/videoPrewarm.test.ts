/**
 * Le préchauffage, branché sur le VRAI cycle de vie (mpv simulé) : ce qui se
 * garde, c'est QUAND une instance mince naît — jamais sur batterie, jamais par
 * dessus une instance vivante, jamais hors montage collé — et que le recyclage
 * comme le retour sur secteur reproduisent la dernière demande de la page.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  mpv: { running: false, commands: [] as string[][], handle: { id: 1 } as object },
  stop: vi.fn(() => Promise.resolve()),
  session: { montage: "wayland" as string | null, windowing: "libre" as string | null },
}));

vi.mock("../video/mpv", () => ({
  command: (args: string[]) => {
    h.mpv.commands.push(args);
    return Promise.resolve(null);
  },
  destroy: vi.fn(),
  handle: () => (h.mpv.running ? h.mpv.handle : null),
  isRunning: () => h.mpv.running,
  reobserve: vi.fn(),
  setProperty: (name: string, value: string) => {
    h.mpv.commands.push(["set", name, value]);
    return Promise.resolve(null);
  },
  setPumpCadence: vi.fn(),
}));
vi.mock("../video/mpvShutdown", () => ({
  stop: vi.fn(() => {
    h.mpv.running = false;
    return h.stop();
  }),
}));
vi.mock("../linux/session", () => ({
  linuxMontage: () => h.session.montage,
  linuxWindowing: () => h.session.windowing,
}));

import { isParked, rememberInit, releasePlayer, reuseParked, stopPlayer } from "./videoLifecycle";
import {
  installPrewarm,
  prewarmPlayer,
  rememberRequest,
  RESUME_PREWARM_DELAY_MS,
  type InitRequest,
} from "./videoPrewarm";

const REQUEST: InitRequest = { page: { vo: "gpu-next", hwdec: "nvdec" }, observed: [["pause", "flag"]] };
const realPlatform = process.platform;

/** Des évènements d'alimentation qu'on déclenche à la main. */
function fakePower(): { on: (e: string, l: () => void) => void; emit: (e: string) => void } {
  const listeners = new Map<string, () => void>();
  return { on: (e, l) => listeners.set(e, l), emit: (e) => listeners.get(e)?.() };
}

let onBattery = false;
const launch = vi.fn((request: InitRequest) => {
  // Ce que fait `launchForRequest` : une instance naît, ses options retenues.
  h.mpv.running = true;
  rememberInit(request.page, request.observed);
  return Promise.resolve(true);
});

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(process, "platform", { value: "linux", configurable: true });
  h.mpv.running = false;
  h.mpv.commands.length = 0;
  h.stop.mockClear();
  h.session.windowing = "libre";
  onBattery = false;
  launch.mockClear();
});

afterEach(async () => {
  await stopPlayer();
  vi.useRealTimers();
  Object.defineProperty(process, "platform", { value: realPlatform, configurable: true });
});

describe("le préchauffage", () => {
  it("fait naître une instance mince, garée sans limite, que le mpv_init suivant reprend", async () => {
    installPrewarm({ onBattery: () => onBattery, launch });
    expect(await prewarmPlayer("test", REQUEST)).toBe("préchauffée");
    expect(launch).toHaveBeenCalledWith(REQUEST);
    expect(isParked()).toBe(true);
    await vi.advanceTimersByTimeAsync(3600_000);
    expect(h.stop).not.toHaveBeenCalled();
    expect(reuseParked(REQUEST.page, REQUEST.observed)).toBe(true);
  });

  it("rien par-dessus une instance vivante", async () => {
    installPrewarm({ onBattery: () => onBattery, launch });
    h.mpv.running = true;
    expect(await prewarmPlayer("test", REQUEST)).toBe("instance déjà là");
    expect(launch).not.toHaveBeenCalled();
  });

  it("rien hors du montage collé", async () => {
    installPrewarm({ onBattery: () => onBattery, launch });
    h.session.windowing = "plein-ecran";
    expect(await prewarmPlayer("test", REQUEST)).toBe("montage sans parking");
    expect(launch).not.toHaveBeenCalled();
  });

  it("sur batterie, rien — mais la demande est retenue pour le retour sur secteur", async () => {
    const power = fakePower();
    installPrewarm({ onBattery: () => onBattery, launch }, power);
    onBattery = true;
    expect(await prewarmPlayer("test", REQUEST)).toBe("sur batterie");
    expect(launch).not.toHaveBeenCalled();
    onBattery = false;
    power.emit("on-ac");
    await vi.advanceTimersByTimeAsync(0);
    expect(launch).toHaveBeenCalledWith(REQUEST);
    expect(isParked()).toBe(true);
  });

  it("le passage sur batterie arrête l'instance garée", async () => {
    const power = fakePower();
    installPrewarm({ onBattery: () => onBattery, launch }, power);
    await prewarmPlayer("test", REQUEST);
    onBattery = true;
    power.emit("on-battery");
    await vi.advanceTimersByTimeAsync(0);
    expect(h.stop).toHaveBeenCalledTimes(1);
    expect(isParked()).toBe(false);
  });

  it("l'instance chaude expirée est remplacée par une mince, à la DERNIÈRE demande de la page", async () => {
    installPrewarm({ onBattery: () => onBattery, launch });
    // Une lecture : mpv_init retient la demande, l'instance vit.
    const played: InitRequest = { page: { ...REQUEST.page, hwdec: "no" }, observed: REQUEST.observed };
    rememberRequest(played);
    h.mpv.running = true;
    rememberInit(played.page, played.observed);
    await releasePlayer();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(h.stop).toHaveBeenCalledTimes(1);
    expect(launch).toHaveBeenCalledWith(played);
    expect(isParked()).toBe(true);
  });

  it("la mise en veille arrête l'instance garée, le réveil en fait naître une neuve", async () => {
    const power = fakePower();
    installPrewarm({ onBattery: () => onBattery, launch }, power);
    await prewarmPlayer("test", REQUEST);
    launch.mockClear();
    power.emit("suspend");
    await vi.advanceTimersByTimeAsync(0);
    expect(h.stop).toHaveBeenCalledTimes(1);
    expect(isParked()).toBe(false);
    power.emit("resume");
    await vi.advanceTimersByTimeAsync(RESUME_PREWARM_DELAY_MS - 1);
    expect(launch).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(launch).toHaveBeenCalledWith(REQUEST);
    expect(isParked()).toBe(true);
  });

  it("une veille en pleine lecture ne coupe rien : seule une instance GARÉE part", async () => {
    const power = fakePower();
    installPrewarm({ onBattery: () => onBattery, launch }, power);
    h.mpv.running = true;
    rememberInit(REQUEST.page, REQUEST.observed);
    power.emit("suspend");
    await vi.advanceTimersByTimeAsync(0);
    expect(h.stop).not.toHaveBeenCalled();
  });
});
