/**
 * Une garde de sortie qui se trompe ne laisse pas une trace dans un journal :
 * elle laisse une fenêtre qui refuse de se fermer, et il ne reste que le
 * gestionnaire des tâches. Ce qui se vérifie ici, ce sont les trois sorties
 * garanties — le loquet, le verrou, et le repli quand la boîte échoue.
 */

import { describe, expect, it } from "vitest";
import { installQuitGuard, type ClosableWindow } from "./quitGuard";

interface TestWindow extends ClosableWindow {
  /** Joue un clic sur la croix. Renvoie vrai si la fermeture a été retenue. */
  closeWindow: () => boolean;
  closes: () => number;
}

/** Une `BrowserWindow` réduite à ce que la garde en touche. */
function fakeWindow(): TestWindow {
  let closeListener: ((event: { preventDefault: () => void }) => void) | null = null;
  let closes = 0;
  const self: TestWindow = {
    on(_event, listener) {
      closeListener = listener;
      return self;
    },
    close() {
      closes += 1;
      self.closeWindow();
    },
    isDestroyed: () => false,
    closeWindow() {
      let held = false;
      closeListener?.({
        preventDefault: () => {
          held = true;
        },
      });
      return held;
    },
    closes: () => closes,
  };
  return self;
}

/** Une boîte de dialogue dont on décide la réponse, et le moment. */
function box(response: boolean): { ask: () => Promise<boolean>; calls: () => number } {
  let calls = 0;
  return {
    ask: () => {
      calls += 1;
      return Promise.resolve(response);
    },
    calls: () => calls,
  };
}

describe("garde de sortie", () => {
  it("laisse fermer quand rien ne telecharge", () => {
    const window = fakeWindow();
    const dialog = box(false);
    installQuitGuard(window, () => 0, dialog.ask);

    expect(window.closeWindow()).toBe(false);
    expect(dialog.calls()).toBe(0);
  });

  it("retient la fermeture et demande, quand un transfert tourne", () => {
    const window = fakeWindow();
    const dialog = box(false);
    installQuitGuard(window, () => 1, dialog.ask);

    expect(window.closeWindow()).toBe(true);
    expect(dialog.calls()).toBe(1);
  });

  // Sans le loquet, le `close()` qui suit l'accord repasserait par la garde,
  // reposerait la question, et la fenetre ne se fermerait jamais.
  it("ferme pour de bon apres l'accord", async () => {
    const window = fakeWindow();
    const dialog = box(true);
    installQuitGuard(window, () => 1, dialog.ask);

    window.closeWindow();
    await Promise.resolve();
    await Promise.resolve();

    expect(window.closes()).toBe(1);
    expect(dialog.calls()).toBe(1);
  });

  it("laisse la fenetre ouverte quand on annule", async () => {
    const window = fakeWindow();
    const dialog = box(false);
    installQuitGuard(window, () => 2, dialog.ask);

    window.closeWindow();
    await Promise.resolve();
    await Promise.resolve();

    expect(window.closes()).toBe(0);
  });

  // Alt+F4 maintenu, ou cliqué deux fois : la fermeture reste retenue, mais on
  // n'empile pas les boites.
  it("n'ouvre qu'une boite pour deux fermetures rapprochees", () => {
    const window = fakeWindow();
    const dialog = box(false);
    installQuitGuard(window, () => 1, dialog.ask);

    expect(window.closeWindow()).toBe(true);
    expect(window.closeWindow()).toBe(true);

    expect(dialog.calls()).toBe(1);
  });

  // Repli : une boite qui ne peut pas s'afficher ne doit pas enfermer
  // l'utilisateur dans sa fenetre.
  it("quitte si la boite echoue", async () => {
    const window = fakeWindow();
    installQuitGuard(window, () => 1, () => Promise.reject(new Error("pas d'affichage")));

    window.closeWindow();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(window.closes()).toBe(1);
  });

  // Meme repli pour le comptage : la base peut etre sur un disque debranche.
  it("laisse fermer si le comptage echoue", () => {
    const window = fakeWindow();
    const dialog = box(false);
    installQuitGuard(
      window,
      () => {
        throw new Error("base indisponible");
      },
      dialog.ask,
    );

    expect(window.closeWindow()).toBe(false);
    expect(dialog.calls()).toBe(0);
  });

  // Apres une annulation, la garde doit redemander a la fermeture suivante.
  it("redemande a la fermeture suivante", async () => {
    const window = fakeWindow();
    const dialog = box(false);
    installQuitGuard(window, () => 1, dialog.ask);

    window.closeWindow();
    await Promise.resolve();
    await Promise.resolve();
    window.closeWindow();

    expect(dialog.calls()).toBe(2);
  });
});
