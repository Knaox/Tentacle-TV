import { describe, expect, it } from "vitest";
import {
  REVEAL_BURST,
  burstTargetBase,
  isInputBurst,
  revealBurstStep,
  revealMove,
  revealSpringOf,
  springAt,
  springSettled,
  unproposedStep,
} from "./revealMotion";

const NONE = [0, 0, 0, 0];

describe("isInputBurst — la télécommande dit-elle une rafale ?", () => {
  it("une flèche enfoncée depuis plus de 200 ms : tvOS répète le pas", () => {
    expect(isInputBurst({ now: 10_000, arrowsDownSince: [0, 9_790, 0, 0], lastTouchAt: 0 })).toBe(true);
    expect(isInputBurst({ now: 10_000, arrowsDownSince: [0, 9_800, 0, 0], lastTouchAt: 0 })).toBe(false);
  });

  it("une flèche enfoncée à l'instant est un appui isolé, même doigt posé sur le pavé", () => {
    expect(isInputBurst({ now: 10_000, arrowsDownSince: [0, 9_950, 0, 0], lastTouchAt: 9_990 })).toBe(false);
  });

  it("aucune flèche : le pavé actif il y a moins de 500 ms, c'est un glisser", () => {
    expect(isInputBurst({ now: 10_000, arrowsDownSince: NONE, lastTouchAt: 9_501 })).toBe(true);
    expect(isInputBurst({ now: 10_000, arrowsDownSince: NONE, lastTouchAt: 9_500 })).toBe(false);
    expect(isInputBurst({ now: 10_000, arrowsDownSince: NONE, lastTouchAt: 0 })).toBe(false);
  });
});

describe("revealBurstStep — ce pas du focus appartient-il à une rafale ?", () => {
  it("la télécommande le dit : rafale, et la fenêtre court 700 ms de plus", () => {
    expect(revealBurstStep({ inputBurst: true, now: 5_000, burstUntil: 0, foreignAt: 0 })).toEqual({ burst: true, burstUntil: 5_700 });
  });

  it("une rafale qui finit garde la main", () => {
    expect(revealBurstStep({ inputBurst: false, now: 5_600, burstUntil: 5_700, foreignAt: 0 })).toEqual({ burst: true, burstUntil: 6_300 });
  });

  it("la plateforme défile encore (posée il y a moins de 50 ms) : on ne la dispute pas", () => {
    expect(revealBurstStep({ inputBurst: false, now: 5_000, burstUntil: 0, foreignAt: 4_960 }).burst).toBe(true);
    expect(revealBurstStep({ inputBurst: false, now: 5_000, burstUntil: 0, foreignAt: 4_950 }).burst).toBe(false);
  });

  it("un pas isolé ne touche pas la fenêtre", () => {
    expect(revealBurstStep({ inputBurst: false, now: 9_000, burstUntil: 5_700, foreignAt: 0 })).toEqual({ burst: false, burstUntil: 5_700 });
  });

  it("la cible d'un pas de rafale part de celle du pas précédent de la même rafale", () => {
    expect(burstTargetBase({ now: 1_600, lastTargetAt: 1_000, lastTarget: 840, offset: 600 })).toBe(840);
    expect(burstTargetBase({ now: 1_700, lastTargetAt: 1_000, lastTarget: 840, offset: 600 })).toBe(600);
  });
});

describe("unproposedStep — un pas de rafale que la plateforme n'a pas défilé", () => {
  const step = { stepAt: 1_000, proposedAt: 0, focusStillInSection: true, now: 1_100, foreignAt: 0, triesLeft: 10 };

  it("rien proposé, la plateforme immobile : la section se montre comme pour un pas isolé", () => {
    expect(unproposedStep(step)).toBe("spring");
  });

  it("une proposition est arrivée pour ce pas (20 ms de jeu), ou le focus est parti : rien", () => {
    expect(unproposedStep({ ...step, proposedAt: 980 })).toBe("drop");
    expect(unproposedStep({ ...step, proposedAt: 979 })).toBe("spring");
    expect(unproposedStep({ ...step, focusStillInSection: false })).toBe("drop");
  });

  it("la plateforme défile encore : réessayer toutes les 100 ms, dix fois au plus", () => {
    expect(REVEAL_BURST.retryMs).toBe(100);
    expect(REVEAL_BURST.retries).toBe(10);
    expect(unproposedStep({ ...step, foreignAt: 1_080 })).toBe("retry");
    expect(unproposedStep({ ...step, foreignAt: 1_080, triesLeft: 0 })).toBe("drop");
  });
});

describe("le ressort de la page", () => {
  it("borné : réponse ≥ 0,05 s, amortissement entre 0,1 et 1", () => {
    expect(revealSpringOf(0.5, 1)).toEqual({ response: 0.5, damping: 1 });
    expect(revealSpringOf(0, 2)).toEqual({ response: 0.05, damping: 1 });
    expect(revealSpringOf(0.4, 0)).toEqual({ response: 0.4, damping: 0.1 });
  });

  it("critique (TV_MOTION.spring.scroll) : 98 % du trajet vers 0,47 s, quelle que soit la distance", () => {
    for (const distance of [200, 1_200]) {
      const at = (t: number) => 1 - springAt(t, -distance, 0, 0.5, 1).x / -distance;
      expect(at(0.45)).toBeLessThan(0.98);
      expect(at(0.5)).toBeGreaterThan(0.98);
    }
  });

  it("un focus en plein vol repart avec la vitesse du mouvement en cours", () => {
    const flying = springAt(0.1, -600, 0, 0.5, 1);
    expect(flying.v).toBeGreaterThan(0);
    expect(springAt(0, flying.x, flying.v, 0.5, 1)).toEqual({ x: flying.x, v: flying.v });
  });

  it("sous-amorti : il dépasse la cible", () => {
    const states = [0.2, 0.3, 0.4].map((t) => springAt(t, -100, 0, 0.5, 0.3).x);
    expect(states.some((x) => x > 0)).toBe(true);
  });

  it("arrivé : moins d'un demi-point et moins de 8 points/s", () => {
    expect(springSettled(0.4, 7)).toBe(true);
    expect(springSettled(0.5, 1)).toBe(false);
    expect(springSettled(0.1, 8)).toBe(false);
  });
});

describe("revealMove — partir, se poser, ou rien", () => {
  const base = { reducedMotion: false, moving: false, target: 400, movingTarget: 0, offset: 0 };

  it("immobile : partir vers une cible, rien si on y est (demi-point)", () => {
    expect(revealMove(base)).toBe("spring");
    expect(revealMove({ ...base, offset: 399.6 })).toBe("none");
  });

  it("en route vers la même cible : rien ; vers une autre : repartir", () => {
    expect(revealMove({ ...base, moving: true, movingTarget: 400.2, offset: 120 })).toBe("none");
    expect(revealMove({ ...base, moving: true, movingTarget: 800, offset: 120 })).toBe("spring");
  });

  it("« Réduire les animations » : se poser aussitôt", () => {
    expect(revealMove({ ...base, reducedMotion: true })).toBe("jump");
    expect(revealMove({ ...base, reducedMotion: true, offset: 400 })).toBe("none");
  });
});
