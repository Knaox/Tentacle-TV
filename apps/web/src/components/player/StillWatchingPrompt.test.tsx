import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { StillWatchingController } from "@tentacle-tv/api-client";
import type { PlayerOverlay } from "@tentacle-tv/shared";

/**
 * « Vous regardez encore ? » sur le web et le bureau : ce que l'encart montre
 * dans chaque phase, où il se pose, ce que fait chaque bouton, et ce qu'il
 * efface du coin bas-droit.
 *
 * Rendu statique, comme les autres bancs de composants du lecteur : pas de
 * DOM dans ce paquet, donc pas de clic simulé — les gestes se prouvent sur la
 * table des boutons (`stillWatchingActions`), celle-là même que l'encart rend.
 * `t()` rend la clé (et `:<count>` quand il y a un nombre).
 */

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) => (options?.count === undefined ? key : `${key}:${String(options.count)}`),
  }),
}));

const { StillWatchingPrompt, stillWatchingActions, countdownSeconds } = await import("./StillWatchingPrompt");
const { overlayBesideStillWatching } = await import("./stillWatchingOverlay");

function controller(phase: StillWatchingController["phase"], remainingMs = 0): StillWatchingController {
  return {
    phase, remainingMs, countdownMs: 10_000,
    reportActivity: vi.fn(), keepWatching: vi.fn(), pauseNow: vi.fn(), resume: vi.fn(),
  };
}

const render = (c: StillWatchingController, options: { controlsVisible?: boolean; surface?: "web" | "desktop" | "mirror" } = {}) =>
  renderToStaticMarkup(<StillWatchingPrompt controller={c} controlsVisible={options.controlsVisible ?? false} surface={options.surface} />);

describe("l'encart « Vous regardez encore ? »", () => {
  it("ne rend rien hors de la question et de la pause", () => {
    expect(render(controller("none"))).toBe("");
  });

  it("pose la question avec son décompte, « Continuer » et « Mettre en pause »", () => {
    const html = render(controller("asking", 7_200));
    expect(html).toContain('role="dialog"');
    expect(html).toContain("data-still-watching");
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("player:stillWatching.title");
    // 7,2 s restantes : on lit 8, arrondi au-dessus.
    expect(html).toContain("player:stillWatching.countdown:8");
    expect(html).toContain("player:stillWatching.continue");
    expect(html).toContain("player:stillWatching.pause");
    expect(html).not.toContain("player:stillWatching.resume");
    // La barre du décompte se vide en transformée, jamais en largeur.
    expect(html).toContain("scaleX(0.72)");
    expect(html).not.toMatch(/style="[^"]*width/);
  });

  it("dit la pause et n'offre que « Reprendre »", () => {
    const html = render(controller("paused"));
    expect(html).toContain("player:stillWatching.pausedTitle");
    expect(html).toContain("player:stillWatching.pausedBody");
    expect(html).toContain("player:stillWatching.resume");
    expect(html).not.toContain("player:stillWatching.continue");
    expect(html).not.toContain("scaleX(");
  });

  it("se pose à la place de la pilule de saut, et monte au-dessus de la barre", () => {
    expect(render(controller("asking", 5_000))).toContain("bottom-10 right-6");
    expect(render(controller("asking", 5_000))).toContain("translate-y-0 z-50");
    expect(render(controller("asking", 5_000), { controlsVisible: true })).toContain("-translate-y-16");
    // Bureau : la couche de la pilule au-dessus de mpv.
    expect(render(controller("asking", 5_000), { surface: "desktop" })).toContain("z-20");
    expect(render(controller("asking", 5_000), { surface: "desktop" })).not.toContain("z-50");
  });

  it("ne porte aucun flou d'arrière-plan (mpv dessine hors du moteur web)", () => {
    expect(render(controller("asking", 5_000), { surface: "desktop" })).not.toContain("backdrop");
  });
});

describe("les boutons de l'encart", () => {
  it("« Mettre en pause » appelle pauseNow, « Continuer » keepWatching", () => {
    const c = controller("asking", 5_000);
    const actions = stillWatchingActions(c);
    expect(actions.map((a) => a.id)).toEqual(["continue", "pause"]);
    expect(actions[0].primary).toBe(true);
    actions.find((a) => a.id === "pause")?.run();
    expect(c.pauseNow).toHaveBeenCalledTimes(1);
    expect(c.keepWatching).not.toHaveBeenCalled();
    actions.find((a) => a.id === "continue")?.run();
    expect(c.keepWatching).toHaveBeenCalledTimes(1);
  });

  it("« Reprendre » appelle resume", () => {
    const c = controller("paused");
    const actions = stillWatchingActions(c);
    expect(actions.map((a) => a.id)).toEqual(["resume"]);
    actions[0].run();
    expect(c.resume).toHaveBeenCalledTimes(1);
  });

  it("ne dit jamais « 0 seconde » tant que la question est posée", () => {
    expect(countdownSeconds(0)).toBe(1);
    expect(countdownSeconds(9_001)).toBe(10);
    expect(countdownSeconds(10_000)).toBe(10);
  });
});

describe("le coin bas-droit pendant la question", () => {
  const skip = { kind: "skip", segmentType: "Intro", labelKey: "skipIntro", action: "skip", countdownSeconds: null, auto: false, dismissible: true } as unknown as PlayerOverlay;
  const nextCard = { kind: "nextCard", final: false, countdownSeconds: 5 } as unknown as PlayerOverlay;
  const finalCard = { kind: "nextCard", final: true, countdownSeconds: 5 } as unknown as PlayerOverlay;

  it("efface la pilule de saut et la carte « à suivre »", () => {
    expect(overlayBesideStillWatching(skip, "asking")).toEqual({ kind: "none" });
    expect(overlayBesideStillWatching(nextCard, "paused")).toEqual({ kind: "none" });
  });

  it("garde l'affiche pleine de fin, et tout hors de la question", () => {
    expect(overlayBesideStillWatching(finalCard, "asking")).toBe(finalCard);
    expect(overlayBesideStillWatching(skip, "none")).toBe(skip);
    expect(overlayBesideStillWatching(skip, undefined)).toBe(skip);
  });
});
