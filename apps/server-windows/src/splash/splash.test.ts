import { describe, expect, it } from "vitest";
import { SPLASH_STRINGS, type SplashStrings } from "../i18n/splashStrings";
import { STRINGS } from "../i18n/strings";
import type { StartupState } from "../tray/menuModel";
import { CLOSE_DELAY_MS, SplashController } from "./splashController";
import { hitTest, splashLayout } from "./splashLayout";
import { canAskStartup, shouldShowSplash, splashView, type SplashContext, type SplashInput, type SplashView } from "./splashModel";

const EMOJI = /\p{Extended_Pictographic}/u;
const context: SplashContext = { strings: STRINGS.fr, splash: SPLASH_STRINGS.fr, dataDir: "C:\\ProgramData\\Tentacle Server", port: 3000 };
const input = (over: Partial<SplashInput> = {}): SplashInput => ({ state: null, wizardOpening: false, setupPending: true, question: "hidden", ...over });

describe("textes de l'écran de démarrage", () => {
  it("ont les mêmes variables en français et en anglais, sans emoji", () => {
    for (const key of Object.keys(SPLASH_STRINGS.fr) as (keyof SplashStrings)[]) {
      const vars = (text: string): string[] => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? "").sort();
      expect(vars(SPLASH_STRINGS.en[key]), key).toEqual(vars(SPLASH_STRINGS.fr[key]));
      expect(EMOJI.test(SPLASH_STRINGS.fr[key]) || EMOJI.test(SPLASH_STRINGS.en[key]), key).toBe(false);
    }
  });
});

describe("ce que dit l'écran de démarrage", () => {
  it("suit les étapes annoncées par le serveur, sans jamais reculer la barre", () => {
    const steps = [
      input(),
      input({ state: { kind: "starting" } }),
      input({ state: { kind: "starting", stage: "database" } }),
      input({ state: { kind: "starting", stage: "extensions" } }),
      input({ state: { kind: "running", port: 3000, version: "1", appState: "setup_jellyfin" }, wizardOpening: true }),
    ].map((i) => splashView(i, context));
    expect(steps.map((v) => v.status)).toEqual([
      "Préparation de Tentacle Server…",
      "Démarrage du serveur…",
      "Préparation de la base de données…",
      "Chargement des extensions…",
      "Ouverture de l'assistant d'installation…",
    ]);
    const bars = steps.map((v) => v.progress ?? 0);
    expect([...bars].sort((a, b) => a - b)).toEqual(bars);
    expect(steps[0]?.detail).toBe("Le premier démarrage peut prendre une minute.");
    expect(steps[4]).toMatchObject({ tone: "done", detail: "L'assistant s'ouvre dans votre navigateur." });
  });

  it("une installation déjà faite : « prêt », et l'icône prend le relais", () => {
    const view = splashView(input({ setupPending: false, state: { kind: "running", port: 3000, version: "1", appState: "running" } }), context);
    expect(view).toMatchObject({ status: "Tentacle Server est prêt.", tone: "done", progress: 1 });
    expect(view.detail).toContain("zone de notification");
  });

  it("un échec dit pourquoi, et offre de réessayer et le journal", () => {
    const view = splashView(input({ state: { kind: "blocked", cause: "port_in_use" }, question: "ask" }), context);
    expect(view).toMatchObject({ status: "Tentacle Server n'a pas pu démarrer.", tone: "error", progress: null, question: null });
    expect(view.detail).toContain("Le port 3000 est déjà utilisé");
    expect(view.buttons.map((b) => b.id)).toEqual(["retry", "open-log", "close"]);
    expect(splashView(input({ state: { kind: "stopped" } }), context).detail).toContain("journal");
  });

  it("pose la question du démarrage avec Oui en premier, puis dit la réponse", () => {
    const asking = splashView(input({ question: "ask" }), context);
    expect(asking.question?.text).toBe("Lancer Tentacle Server au démarrage de Windows ?");
    expect(asking.buttons).toEqual([
      { id: "startup-yes", label: "Oui", primary: true },
      { id: "startup-no", label: "Non", primary: false },
    ]);
    expect(splashView(input({ question: "saving" }), context)).toMatchObject({ buttons: [], detail: "Enregistrement de votre choix…" });
    expect(splashView(input({ question: { answered: false } }), context)).toMatchObject({ question: null, detail: "Tentacle Server ne se lancera pas avec Windows." });
  });

  it("ne pose la question que si Windows laisse régler le démarrage", () => {
    const allowed: StartupState[] = ["enabled", "disabled", "disabled-by-user"];
    const refused: StartupState[] = ["disabled-by-policy", "enabled-by-policy", "unavailable"];
    for (const state of allowed) expect(canAskStartup(false, state), state).toBe(true);
    for (const state of refused) expect(canAskStartup(false, state), state).toBe(false);
    expect(canAskStartup(true, "disabled")).toBe(false);
  });

  it("au démarrage de session, ne se montre que s'il reste quelque chose à dire", () => {
    expect(shouldShowSplash({ atLogon: false, setupPending: false, startupAsked: true })).toBe(true);
    expect(shouldShowSplash({ atLogon: true, setupPending: false, startupAsked: true })).toBe(false);
    expect(shouldShowSplash({ atLogon: true, setupPending: true, startupAsked: true })).toBe(true);
    expect(shouldShowSplash({ atLogon: true, setupPending: false, startupAsked: false })).toBe(true);
  });
});

describe("mise en page de l'écran de démarrage", () => {
  it("grandit pour la question, et garde ses boutons dans la fenêtre", () => {
    const plain = splashLayout(splashView(input(), context));
    const asking = splashLayout(splashView(input({ question: "ask" }), context));
    expect(asking.height).toBeGreaterThan(plain.height);
    for (const { rect } of asking.buttons) {
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width).toBeLessThanOrEqual(asking.width);
      expect(rect.y + rect.height).toBeLessThan(asking.height);
    }
    // Pendant l'enregistrement, la fenêtre garde sa taille.
    expect(splashLayout(splashView(input({ question: "saving" }), context)).height).toBe(asking.height);
  });

  it("le clic trouve le bouton visé, la croix, ou rien (la fenêtre se déplace)", () => {
    const layout = splashLayout(splashView(input({ question: "ask" }), context));
    const yes = layout.buttons[0]?.rect;
    expect(yes).toBeDefined();
    if (!yes) return;
    expect(hitTest(layout, yes.x + 2, yes.y + 2)).toBe("startup-yes");
    expect(hitTest(layout, layout.close.x + 4, layout.close.y + 4)).toBe("close");
    expect(hitTest(layout, layout.logo.x + 10, layout.logo.y + 10)).toBeNull();
  });

  it("trois boutons d'échec tiennent côte à côte", () => {
    const layout = splashLayout(splashView(input({ state: { kind: "stopped" } }), context));
    expect(layout.buttons).toHaveLength(3);
    const last = layout.buttons[2]?.rect;
    expect(last && last.x + last.width).toBeLessThanOrEqual(layout.width);
  });
});

function controllerHarness(options: { startup?: StartupState; asked?: boolean } = {}) {
  const views: SplashView[] = [];
  const timers: { run: () => void; ms: number; cancelled: boolean }[] = [];
  const calls: string[] = [];
  let closed = 0;
  let resolveStartup: (state: StartupState) => void = () => undefined;
  const startupRead = new Promise<StartupState>((resolve) => (resolveStartup = resolve));
  const controller = new SplashController({
    surface: { render: (view) => views.push(view), close: () => closed++ },
    context,
    setupPending: true,
    readStartup: () => startupRead,
    startupAsked: () => options.asked ?? false,
    answerStartup: async (enabled) => void calls.push(`answer:${enabled}`),
    openLog: () => calls.push("log"),
    retry: async () => void calls.push("retry"),
    log: () => undefined,
    schedule: (run, ms) => {
      const timer = { run, ms, cancelled: false };
      timers.push(timer);
      return () => (timer.cancelled = true);
    },
  });
  const started = controller.start();
  const settle = async (state: StartupState = options.startup ?? "enabled"): Promise<void> => {
    resolveStartup(state);
    await started;
  };
  const pending = () => timers.filter((t) => !t.cancelled);
  return { controller, views, calls, closed: () => closed, settle, pending, last: () => views.at(-1) };
}

const running = { kind: "running", port: 3000, version: "1", appState: "setup_jellyfin" } as const;

describe("SplashController", () => {
  it("se montre aussitôt, puis pose la question une fois l'état du démarrage connu", async () => {
    const h = controllerHarness();
    expect(h.views[0]?.status).toBe("Préparation de Tentacle Server…");
    await h.settle("enabled");
    expect(h.last()?.question).not.toBeNull();
  });

  it("ne se ferme pas tant que la question attend, puis se ferme après la réponse", async () => {
    const h = controllerHarness();
    await h.settle();
    h.controller.onServerState(running, true);
    expect(h.pending()).toHaveLength(0);
    await h.controller.onAction("startup-yes");
    expect(h.calls).toEqual(["answer:true"]);
    expect(h.last()?.detail).toBe("Tentacle Server se lancera avec Windows.");
    expect(h.pending().map((t) => t.ms)).toEqual([CLOSE_DELAY_MS.answered]);
    h.pending()[0]?.run();
    expect(h.closed()).toBe(1);
    expect(h.controller.isOpen).toBe(false);
  });

  it("question déjà répondue : se ferme seul quand l'assistant s'ouvre", async () => {
    const h = controllerHarness({ asked: true });
    h.controller.onServerState(running, true);
    // L'état du démarrage n'est pas encore connu : on attend avant de fermer.
    expect(h.pending()).toHaveLength(0);
    await h.settle();
    expect(h.last()?.question).toBeNull();
    expect(h.pending().map((t) => t.ms)).toEqual([CLOSE_DELAY_MS.wizard]);
    expect(h.last()?.status).toBe("Ouverture de l'assistant d'installation…");
  });

  it("un échec reste à l'écran ; réessayer et le journal passent à l'hôte", async () => {
    const h = controllerHarness({ asked: true });
    await h.settle();
    h.controller.onServerState({ kind: "blocked", cause: "crash_loop" }, false);
    expect(h.pending()).toHaveLength(0);
    await h.controller.onAction("open-log");
    await h.controller.onAction("retry");
    expect(h.calls).toEqual(["log", "retry"]);
    expect(h.controller.isOpen).toBe(true);
  });

  it("fermé à la croix, il ne se rouvre plus", async () => {
    const h = controllerHarness();
    await h.settle();
    await h.controller.onAction("close");
    const count = h.views.length;
    h.controller.onServerState(running, true);
    expect(h.views).toHaveLength(count);
    expect(h.closed()).toBe(1);
  });
});
