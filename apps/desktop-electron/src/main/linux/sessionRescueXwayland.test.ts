/**
 * Le filet de XWayland-auto : `auto` choisit XWayland sous GNOME et wlroots
 * sans écran HDR (`graphicsSession.ts`). C'est le même risque que le `x11`
 * du 27.08 — un XWayland qui n'affiche pas —, sans qu'aucun réglage ne soit à
 * redresser : un lancement raté doit bloquer XWayland-auto, pas l'app.
 */
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  XWAYLAND_AUTO_OFF,
  XWAYLAND_AUTO_TRIAL,
  sessionShown,
  watchGpu,
  writeXwaylandAutoTrial,
  xwaylandAutoBlocked,
} from "./sessionRescue";

const folder = (): string => mkdtempSync(path.join(tmpdir(), "xwayland-auto-"));

describe("XWayland-auto", () => {
  it("un essai qui a affiché laisse XWayland-auto permis", () => {
    const dir = folder();
    writeXwaylandAutoTrial(dir);
    sessionShown();
    expect(existsSync(path.join(dir, XWAYLAND_AUTO_TRIAL))).toBe(false);
    expect(xwaylandAutoBlocked(dir)).toBe(false);
  });

  it("un essai jamais soldé bloque XWayland-auto au lancement suivant", () => {
    const dir = folder();
    vi.spyOn(console, "error").mockImplementation(() => {});
    writeXwaylandAutoTrial(dir);
    // …l'app meurt avant sa première image.
    expect(xwaylandAutoBlocked(dir)).toBe(true);
    expect(existsSync(path.join(dir, XWAYLAND_AUTO_TRIAL))).toBe(false);
    expect(xwaylandAutoBlocked(dir)).toBe(true);
  });

  it("trois morts du GPU pendant l'essai le bloquent et relancent", () => {
    const dir = folder();
    vi.spyOn(console, "error").mockImplementation(() => {});
    let listener: ((e: unknown, d: { type: string; reason: string }) => void) | null = null;
    const application = {
      on: (_e: "child-process-gone", fn: typeof listener) => { listener = fn; },
      relaunch: vi.fn(),
      exit: vi.fn(),
    };
    writeXwaylandAutoTrial(dir);
    watchGpu(dir, application as never);
    for (let i = 0; i < 3; i++) listener!({}, { type: "GPU", reason: "crashed" });
    expect(application.relaunch).toHaveBeenCalledTimes(1);
    expect(existsSync(path.join(dir, XWAYLAND_AUTO_OFF))).toBe(true);
    expect(xwaylandAutoBlocked(dir)).toBe(true);
  });
});
