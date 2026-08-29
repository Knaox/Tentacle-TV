/**
 * Une séquence de fermeture qui se trompe donne le pire des deux mondes : une
 * fenêtre cachée et une application vivante, qu'aucun geste ne rattrape. Ce qui
 * se vérifie ici, ce sont les quatre sorties garanties — pas de lecteur, lecteur,
 * garde de sortie qui a déjà retenu la fermeture, et arrêt qui ne rend jamais la
 * main.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CLOSE_DEADLINE_MS, installCloseSequence, type ClosingWindow } from "./closeSequence";

interface TestWindow extends ClosingWindow {
  /** Joue un clic sur la croix. `held` dit si la fermeture a été retenue. */
  closeWindow: (defaultPrevented?: boolean) => boolean;
  hides: () => number;
  destroys: () => number;
}

/** Une `BrowserWindow` réduite à ce que la séquence en touche. */
function fakeWindow(): TestWindow {
  let listener: ((event: { preventDefault: () => void; defaultPrevented: boolean }) => void) | null = null;
  let hides = 0;
  let destroys = 0;
  const self: TestWindow = {
    on(_event, next) {
      listener = next;
      return self;
    },
    hide() {
      hides += 1;
    },
    destroy() {
      destroys += 1;
    },
    isDestroyed: () => destroys > 0,
    closeWindow(defaultPrevented = false) {
      let held = defaultPrevented;
      listener?.({
        preventDefault: () => {
          held = true;
        },
        defaultPrevented,
      });
      return held;
    },
    hides: () => hides,
    destroys: () => destroys,
  };
  return self;
}

/** Un arrêt de lecteur dont on décide le moment. */
function fakeStop() {
  let release: (() => void) | null = null;
  let calls = 0;
  return {
    calls: () => calls,
    stop: (): Promise<void> => {
      calls += 1;
      return new Promise<void>((resolve) => {
        release = resolve;
      });
    },
    finish: () => {
      release?.();
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("séquence de fermeture", () => {
  it("laisse passer la fermeture quand aucun lecteur ne tourne", () => {
    const window = fakeWindow();
    const player = fakeStop();
    installCloseSequence(window, () => false, player.stop);

    expect(window.closeWindow()).toBe(false);
    expect(player.calls()).toBe(0);
    expect(window.hides()).toBe(0);
  });

  it("cache la fenêtre TOUT DE SUITE, puis détruit quand mpv a rendu la main", async () => {
    const window = fakeWindow();
    const player = fakeStop();
    installCloseSequence(window, () => true, player.stop);

    expect(window.closeWindow()).toBe(true);
    // Le même tour de boucle : la fenêtre est déjà partie, l'arrêt est lancé.
    expect(window.hides()).toBe(1);
    expect(player.calls()).toBe(1);
    expect(window.destroys()).toBe(0);

    player.finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(window.destroys()).toBe(1);
  });

  it("ne fait rien quand la garde de sortie a déjà retenu la fermeture", () => {
    const window = fakeWindow();
    const player = fakeStop();
    installCloseSequence(window, () => true, player.stop);

    window.closeWindow(true);
    expect(player.calls()).toBe(0);
    expect(window.hides()).toBe(0);
  });

  it("détruit quand même la fenêtre si mpv ne rend jamais la main", async () => {
    const window = fakeWindow();
    const player = fakeStop();
    installCloseSequence(window, () => true, player.stop);

    window.closeWindow();
    await vi.advanceTimersByTimeAsync(CLOSE_DEADLINE_MS);
    expect(window.destroys()).toBe(1);

    // Et l'arrêt qui aboutit après coup ne détruit pas une seconde fois.
    player.finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(window.destroys()).toBe(1);
  });

  it("laisse la seconde fermeture passer pendant le démontage", () => {
    const window = fakeWindow();
    const player = fakeStop();
    installCloseSequence(window, () => true, player.stop);

    window.closeWindow();
    // Deuxième Alt+F4 : plus rien n'est retenu, la fenêtre se ferme pour de bon.
    expect(window.closeWindow()).toBe(false);
    expect(player.calls()).toBe(1);
  });

  it("ne retient pas la fermeture si l'état du lecteur est illisible", () => {
    const window = fakeWindow();
    const player = fakeStop();
    installCloseSequence(window, () => {
      throw new Error("poignée perdue");
    }, player.stop);

    expect(window.closeWindow()).toBe(false);
    expect(window.hides()).toBe(0);
  });
});
