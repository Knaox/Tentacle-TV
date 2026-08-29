/**
 * SurfaceWayland — l'orchestration de la visée, pas la mesure elle-même.
 *
 * `displayTarget` est mocké (il a ses propres tests) : ici on garde l'ORDRE
 * des gestes et les invariants — attach ne rend la main qu'une fois
 * `fs-screen-name` posé (c'est ce qui retient le `loadfile` de la page), la
 * visée par bounds a disparu, et un détachement coupe tout ce qui vole.
 *
 * Ce que ce banc ne peut PAS éprouver : le compositeur réel (sur quel écran la
 * fenêtre se mappe, ce que `hide()` émet) — c'est l'affaire du banc de mesure
 * hors dépôt (docs/LINUX-FENETRE-VIDEO.md, « L'empilement multi-écrans »).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SurfaceWayland } from "./surfaceWayland";

const h = vi.hoisted(() => ({
  labelOnceMapped: vi.fn<() => Promise<string | null>>(),
  connectorForLabel: vi.fn<() => string | null>(),
  connectedDisplays: vi.fn(() => []),
  setProperty: vi.fn<() => Promise<string | null>>(),
}));
vi.mock("./displayTarget", () => ({ labelOnceMapped: h.labelOnceMapped }));
vi.mock("./displays", () => ({
  connectorForLabel: h.connectorForLabel,
  connectedDisplays: h.connectedDisplays,
}));
vi.mock("../video/mpv", () => ({ setProperty: h.setProperty }));

/** Une fenêtre à état réel : le journal dit l'ordre, l'état dit l'effet. */
function window(options: { fullscreen?: boolean } = {}) {
  const listeners = new Map<string, Set<() => void>>();
  const state = { fullscreen: options.fullscreen ?? false, destroyed: false };
  const log: string[] = [];
  return {
    state,
    log,
    isDestroyed: () => state.destroyed,
    isFullScreen: () => state.fullscreen,
    setFullScreen: vi.fn((v: boolean) => {
      log.push(`setFullScreen(${v})`);
      state.fullscreen = v;
    }),
    focus: vi.fn(() => log.push("focus")),
    hide: vi.fn(() => log.push("hide")),
    show: vi.fn(() => log.push("show")),
    getBounds: vi.fn(() => ({ x: 0, y: 0, width: 1280, height: 800 })),
    on: (evt: string, fn: () => void) => {
      if (!listeners.has(evt)) listeners.set(evt, new Set());
      listeners.get(evt)?.add(fn);
    },
    removeListener: (evt: string, fn: () => void) => listeners.get(evt)?.delete(fn),
    emit: (evt: string) => {
      for (const fn of listeners.get(evt) ?? []) fn();
    },
    webContents: { executeJavaScript: vi.fn() },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.labelOnceMapped.mockResolvedValue("ASUSTek COMPUTER INC XG27UCDMG");
  h.connectorForLabel.mockReturnValue("DP-4");
  h.setProperty.mockResolvedValue(null);
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("attach — la visée se joue avant de rendre la main", () => {
  it("pose le plein écran et le focus, puis vise et écrit le connecteur", async () => {
    const win = window();
    await new SurfaceWayland(win as never).attach();
    expect(win.log.slice(0, 2)).toEqual(["setFullScreen(true)", "focus"]);
    expect(h.setProperty).toHaveBeenCalledWith("fs-screen-name", "DP-4");
  });

  it("ne rend la main qu'une fois fs-screen-name posé", async () => {
    // C'est le contrat qui retient le `loadfile` : la page n'envoie rien tant
    // que `mpv_init` n'a pas répondu, et `mpv_init` attend cet attach.
    let apply: (v: string | null) => void = () => {};
    h.setProperty.mockReturnValue(new Promise((r) => { apply = r; }));
    const win = window();
    let render = false;
    const promise = new SurfaceWayland(win as never).attach().then(() => { render = true; });
    await Promise.resolve();
    await Promise.resolve();
    expect(render).toBe(false);
    apply(null);
    await promise;
    expect(render).toBe(true);
  });

  it("sans correspondance, n'écrit rien — et ne consulte jamais les bounds", async () => {
    // La visée par bounds désignait l'écran posé en (0,0) : mesurée fausse,
    // supprimée. Dans le doute, mpv choisit seul.
    h.labelOnceMapped.mockResolvedValue(null);
    const win = window();
    const surface = new SurfaceWayland(win as never);
    await surface.attach();
    expect(h.setProperty).not.toHaveBeenCalled();
    expect(win.getBounds).not.toHaveBeenCalled();
    // La visée se rejoue, le journal ne doit pas : un avertissement par cause.
    surface.align();
    await Promise.resolve();
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it("un connecteur déjà posé ne se réécrit pas", async () => {
    const win = window();
    const surface = new SurfaceWayland(win as never);
    await surface.attach();
    surface.align();
    await vi.waitFor(() => expect(h.labelOnceMapped).toHaveBeenCalledTimes(2));
    expect(h.setProperty).toHaveBeenCalledTimes(1);
  });

  it("une écriture refusée est tracée, jamais fatale", async () => {
    h.setProperty.mockResolvedValue("property not found");
    const win = window();
    await new SurfaceWayland(win as never).attach();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("refusé"));
  });
});

describe("detach — tout ce qui vole retombe", () => {
  it("coupe une visée en vol : rien ne s'écrit après lui", async () => {
    let deliver: (v: string | null) => void = () => {};
    h.labelOnceMapped.mockReturnValue(new Promise((r) => { deliver = r; }));
    const win = window();
    const surface = new SurfaceWayland(win as never);
    const promise = surface.attach();
    surface.detach();
    deliver("ASUSTek COMPUTER INC XG27UCDMG");
    await promise;
    expect(h.setProperty).not.toHaveBeenCalled();
  });

  it("rend le plein écran seulement s'il l'avait posé", async () => {
    const applied = window({ fullscreen: false });
    const appliedSurface = new SurfaceWayland(applied as never);
    await appliedSurface.attach();
    appliedSurface.detach();
    expect(applied.log).toContain("setFullScreen(false)");

    const inherited = window({ fullscreen: true });
    const inheritedSurface = new SurfaceWayland(inherited as never);
    await inheritedSurface.attach();
    inheritedSurface.detach();
    expect(inherited.log).not.toContain("setFullScreen(false)");
  });

  it("retire la réaffirmation du plein écran avec lui", async () => {
    const win = window();
    const surface = new SurfaceWayland(win as never);
    await surface.attach();
    win.emit("leave-full-screen");
    const callbacks = win.log.filter((l) => l === "setFullScreen(true)").length;
    expect(callbacks).toBe(2); // l'attach, puis la réaffirmation
    surface.detach();
    win.emit("leave-full-screen");
    expect(win.log.filter((l) => l === "setFullScreen(true)").length).toBe(callbacks);
  });
});

describe("fichierCharge — repasser devant par l'activation, jamais par un geste", () => {
  it("attend la naissance de la fenêtre mpv puis demande le focus, rien d'autre", async () => {
    // hide()/show() mesurés NUISIBLES : ils donnent l'activation à mpv et
    // laissent le compositeur replacer la fenêtre n'importe où. Le seul geste
    // permis est la demande d'activation — et après le délai mesuré, pas
    // avant : une fenêtre mpv née APRÈS notre focus reprendrait le dessus.
    vi.useFakeTimers();
    const win = window();
    const surface = new SurfaceWayland(win as never);
    await surface.attach();
    const before = win.log.length;
    surface.fileLoaded();
    expect(win.log.length).toBe(before); // rien avant le délai
    await vi.advanceTimersByTimeAsync(300);
    expect(win.log.slice(before)).toEqual(["focus"]);
    expect(win.hide).not.toHaveBeenCalled();
    expect(win.show).not.toHaveBeenCalled();
  });

  it("un second file-loaded pendant l'attente n'arme qu'une reprise", async () => {
    vi.useFakeTimers();
    const win = window();
    const surface = new SurfaceWayland(win as never);
    await surface.attach();
    const before = win.focus.mock.calls.length;
    surface.fileLoaded();
    surface.fileLoaded();
    await vi.advanceTimersByTimeAsync(600);
    expect(win.focus.mock.calls.length).toBe(before + 1);
  });

  it("détachée, la surface ne demande plus rien", async () => {
    // Fin de lecture éclair, changement d'épisode : le minuteur part avec elle.
    vi.useFakeTimers();
    const win = window();
    const surface = new SurfaceWayland(win as never);
    await surface.attach();
    const before = win.focus.mock.calls.length;
    surface.fileLoaded();
    surface.detach();
    await vi.advanceTimersByTimeAsync(600);
    expect(win.focus.mock.calls.length).toBe(before);
  });

  it("jamais attachée, elle ne bouge pas", async () => {
    vi.useFakeTimers();
    const win = window();
    const surface = new SurfaceWayland(win as never);
    surface.fileLoaded();
    await vi.advanceTimersByTimeAsync(600);
    expect(win.focus).not.toHaveBeenCalled();
  });
});
