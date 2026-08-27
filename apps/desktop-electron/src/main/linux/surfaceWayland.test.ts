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
  libelleUneFoisMappee: vi.fn<() => Promise<string | null>>(),
  connecteurPourLibelle: vi.fn<() => string | null>(),
  ecransConnectes: vi.fn(() => []),
  setProperty: vi.fn<() => Promise<string | null>>(),
}));
vi.mock("./displayTarget", () => ({ libelleUneFoisMappee: h.libelleUneFoisMappee }));
vi.mock("./ecrans", () => ({
  connecteurPourLibelle: h.connecteurPourLibelle,
  ecransConnectes: h.ecransConnectes,
}));
vi.mock("../video/mpv", () => ({ setProperty: h.setProperty }));

/** Une fenêtre à état réel : le journal dit l'ordre, l'état dit l'effet. */
function fenetre(options: { pleinEcran?: boolean } = {}) {
  const auditeurs = new Map<string, Set<() => void>>();
  const etat = { pleinEcran: options.pleinEcran ?? false, detruite: false };
  const journal: string[] = [];
  return {
    etat,
    journal,
    isDestroyed: () => etat.detruite,
    isFullScreen: () => etat.pleinEcran,
    setFullScreen: vi.fn((v: boolean) => {
      journal.push(`setFullScreen(${v})`);
      etat.pleinEcran = v;
    }),
    focus: vi.fn(() => journal.push("focus")),
    getBounds: vi.fn(() => ({ x: 0, y: 0, width: 1280, height: 800 })),
    on: (evt: string, fn: () => void) => {
      if (!auditeurs.has(evt)) auditeurs.set(evt, new Set());
      auditeurs.get(evt)?.add(fn);
    },
    removeListener: (evt: string, fn: () => void) => auditeurs.get(evt)?.delete(fn),
    emettre: (evt: string) => {
      for (const fn of auditeurs.get(evt) ?? []) fn();
    },
    webContents: { executeJavaScript: vi.fn() },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.libelleUneFoisMappee.mockResolvedValue("ASUSTek COMPUTER INC XG27UCDMG");
  h.connecteurPourLibelle.mockReturnValue("DP-4");
  h.setProperty.mockResolvedValue(null);
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("attach — la visée se joue avant de rendre la main", () => {
  it("pose le plein écran et le focus, puis vise et écrit le connecteur", async () => {
    const win = fenetre();
    await new SurfaceWayland(win as never).attach();
    expect(win.journal.slice(0, 2)).toEqual(["setFullScreen(true)", "focus"]);
    expect(h.setProperty).toHaveBeenCalledWith("fs-screen-name", "DP-4");
  });

  it("ne rend la main qu'une fois fs-screen-name posé", async () => {
    // C'est le contrat qui retient le `loadfile` : la page n'envoie rien tant
    // que `mpv_init` n'a pas répondu, et `mpv_init` attend cet attach.
    let poser: (v: string | null) => void = () => {};
    h.setProperty.mockReturnValue(new Promise((r) => { poser = r; }));
    const win = fenetre();
    let rendu = false;
    const promesse = new SurfaceWayland(win as never).attach().then(() => { rendu = true; });
    await Promise.resolve();
    await Promise.resolve();
    expect(rendu).toBe(false);
    poser(null);
    await promesse;
    expect(rendu).toBe(true);
  });

  it("sans correspondance, n'écrit rien — et ne consulte jamais les bounds", async () => {
    // La visée par bounds désignait l'écran posé en (0,0) : mesurée fausse,
    // supprimée. Dans le doute, mpv choisit seul.
    h.libelleUneFoisMappee.mockResolvedValue(null);
    const win = fenetre();
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
    const win = fenetre();
    const surface = new SurfaceWayland(win as never);
    await surface.attach();
    surface.align();
    await vi.waitFor(() => expect(h.libelleUneFoisMappee).toHaveBeenCalledTimes(2));
    expect(h.setProperty).toHaveBeenCalledTimes(1);
  });

  it("une écriture refusée est tracée, jamais fatale", async () => {
    h.setProperty.mockResolvedValue("property not found");
    const win = fenetre();
    await new SurfaceWayland(win as never).attach();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("refusé"));
  });
});

describe("detach — tout ce qui vole retombe", () => {
  it("coupe une visée en vol : rien ne s'écrit après lui", async () => {
    let livrer: (v: string | null) => void = () => {};
    h.libelleUneFoisMappee.mockReturnValue(new Promise((r) => { livrer = r; }));
    const win = fenetre();
    const surface = new SurfaceWayland(win as never);
    const promesse = surface.attach();
    surface.detach();
    livrer("ASUSTek COMPUTER INC XG27UCDMG");
    await promesse;
    expect(h.setProperty).not.toHaveBeenCalled();
  });

  it("rend le plein écran seulement s'il l'avait posé", async () => {
    const posee = fenetre({ pleinEcran: false });
    const surfacePosee = new SurfaceWayland(posee as never);
    await surfacePosee.attach();
    surfacePosee.detach();
    expect(posee.journal).toContain("setFullScreen(false)");

    const heritee = fenetre({ pleinEcran: true });
    const surfaceHeritee = new SurfaceWayland(heritee as never);
    await surfaceHeritee.attach();
    surfaceHeritee.detach();
    expect(heritee.journal).not.toContain("setFullScreen(false)");
  });

  it("retire la réaffirmation du plein écran avec lui", async () => {
    const win = fenetre();
    const surface = new SurfaceWayland(win as never);
    await surface.attach();
    win.emettre("leave-full-screen");
    const rappels = win.journal.filter((l) => l === "setFullScreen(true)").length;
    expect(rappels).toBe(2); // l'attach, puis la réaffirmation
    surface.detach();
    win.emettre("leave-full-screen");
    expect(win.journal.filter((l) => l === "setFullScreen(true)").length).toBe(rappels);
  });
});
