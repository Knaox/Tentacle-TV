import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * La relance de plateforme (`ozoneRelaunchArgs`) et les filets de
 * `sessionRescue.ts`, joués ensemble comme au démarrage.
 *
 * Le cas qui manquait (mesuré le 22.10 sous GNOME headless) : un XWayland
 * injoignable tue le processus RELANCÉ avant la moindre ligne de notre code
 * (« Missing X server »). Les témoins doivent donc être posés par le
 * processus qui relance, et ne compter comme un échec qu'au lancement
 * suivant — jamais dans la relance elle-même.
 */

const { state, relaunches } = vi.hoisted(() => ({
  state: { userData: "", hdr: false },
  relaunches: [] as { args: string[] }[],
}));

vi.mock("electron", () => ({
  app: {
    getPath: () => state.userData,
    commandLine: { appendSwitch: () => undefined },
    relaunch: (options: { args: string[] }) => { relaunches.push(options); },
    exit: () => undefined,
    on: () => undefined,
  },
}));
vi.mock("./edidHdr", () => ({ hdrDisplayConnected: () => state.hdr }));
vi.mock("./kwinScripting", () => ({ kwinScriptApiAvailable: () => Promise.resolve(false) }));
vi.mock("./glueCleanup", () => ({ sweepOrphanGlue: () => Promise.resolve(0) }));

import { saveSessionChoice } from "./session";
import { readSessionChoice, SESSION_RELAUNCH_FLAG } from "./graphicsSession";
import { readWitness, XWAYLAND_AUTO_OFF, XWAYLAND_AUTO_TRIAL } from "./sessionRescue";

const ENV = ["WAYLAND_DISPLAY", "XDG_SESSION_TYPE", "DISPLAY", "XDG_CURRENT_DESKTOP", "TENTACLE_LINUX_SESSION"];
const saved = Object.fromEntries(ENV.map((name) => [name, process.env[name]]));
const realPlatform = process.platform;
const realArgv = process.argv;
let folder: string;

/** Un lancement : argv donné, module de session neuf (son état est par processus). */
async function launch(argv: string[]): Promise<typeof import("./session")> {
  process.argv = ["/opt/tentacle/tentacle-tv", ...argv];
  relaunches.length = 0;
  vi.resetModules();
  const session = await import("./session");
  session.applyGraphicsSession();
  return session;
}

/** Les arguments que la relance a demandés — ce que le processus suivant recevra. */
const relaunchedArgv = (): string[] => relaunches[0]?.args ?? [];

beforeEach(() => {
  folder = mkdtempSync(path.join(tmpdir(), "tentacle-relaunch-"));
  state.userData = folder;
  state.hdr = false;
  Object.defineProperty(process, "platform", { value: "linux", configurable: true });
  // GNOME Wayland avec XWayland, sans écran HDR : `auto` y prend XWayland.
  Object.assign(process.env, { WAYLAND_DISPLAY: "wayland-0", XDG_SESSION_TYPE: "wayland", DISPLAY: ":0", XDG_CURRENT_DESKTOP: "GNOME" });
  delete process.env["TENTACLE_LINUX_SESSION"];
});

afterEach(() => {
  rmSync(folder, { recursive: true, force: true });
  Object.defineProperty(process, "platform", { value: realPlatform, configurable: true });
  process.argv = realArgv;
  for (const name of ENV) {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
  }
});

describe("XWayland-auto : relance, puis secours", () => {
  it("relance sur X11 en posant l'essai AVANT, et la relance ne le prend pas pour un échec", async () => {
    let session = await launch([]);
    expect(session.relaunchingForSession()).toBe(true);
    expect(relaunchedArgv()).toEqual(["--ozone-platform=x11", SESSION_RELAUNCH_FLAG]);
    expect(existsSync(path.join(folder, XWAYLAND_AUTO_TRIAL))).toBe(true);

    session = await launch(relaunchedArgv());
    expect(session.relaunchingForSession()).toBe(false);
    expect(session.linuxMontage()).toBe("x11");
    expect(existsSync(path.join(folder, XWAYLAND_AUTO_OFF))).toBe(false);
  });

  it("relance morte avant notre code : le lancement suivant bloque XWayland et reste sur Wayland", async () => {
    await launch([]);
    // … la relance meurt (« Missing X server ») : l'essai reste en place.
    const session = await launch([]);
    expect(existsSync(path.join(folder, XWAYLAND_AUTO_OFF))).toBe(true);
    expect(session.relaunchingForSession()).toBe(false);
    expect(session.linuxMontage()).toBe("wayland");
  });

  it("écran HDR : Wayland d'emblée, ni relance ni essai", async () => {
    state.hdr = true;
    const session = await launch([]);
    expect(session.relaunchingForSession()).toBe(false);
    expect(session.linuxMontage()).toBe("wayland");
    expect(existsSync(path.join(folder, XWAYLAND_AUTO_TRIAL))).toBe(false);
  });
});

describe("choix explicite « x11 » sous Wayland", () => {
  it("témoin posé avant la relance, gardé par la relance, compté au lancement d'après", async () => {
    saveSessionChoice("x11");
    await launch([]);
    expect(readWitness(folder)).toBe("x11");

    await launch(relaunchedArgv());
    expect(readSessionChoice(folder)).toBe("x11");

    // La relance n'a jamais montré de fenêtre : au lancement suivant, retour en auto.
    await launch([]);
    expect(readSessionChoice(folder)).toBe("auto");
  });
});
