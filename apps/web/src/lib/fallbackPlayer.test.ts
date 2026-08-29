/**
 * L'invariant tenu ici : la bascule de secours est une mémoire de SESSION —
 * elle ne s'écrit que par `reportFallbackSwitch`, et l'erreur de MÉDIA
 * (fichier local disparu) ne l'écrit JAMAIS : c'est tout l'objet du
 * classement de `hooks/playbackFailure.ts`. Le store est un module à état :
 * chaque test recharge le module pour repartir à zéro.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

async function chargerStore() {
  return import("./fallbackPlayer");
}

describe("fallbackPlayer", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("démarre sans bascule", async () => {
    const store = await chargerStore();
    expect(store.isFallbackActive()).toBe(false);
  });

  it("signaler mémorise pour la session", async () => {
    const store = await chargerStore();
    store.reportFallbackSwitch();
    expect(store.isFallbackActive()).toBe(true);
  });

  it("annuler rend le lecteur natif", async () => {
    const store = await chargerStore();
    store.reportFallbackSwitch();
    store.cancelFallbackSwitch();
    expect(store.isFallbackActive()).toBe(false);
  });
});
