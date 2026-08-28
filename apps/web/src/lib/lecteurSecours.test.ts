/**
 * L'invariant tenu ici : la bascule de secours est une mémoire de SESSION —
 * elle ne s'écrit que par `signalerBasculeSecours`, et l'erreur de MÉDIA
 * (fichier local disparu) ne l'écrit JAMAIS : c'est tout l'objet du
 * classement de `hooks/playbackFailure.ts`. Le store est un module à état :
 * chaque test recharge le module pour repartir à zéro.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

async function chargerStore() {
  return import("./lecteurSecours");
}

describe("lecteurSecours", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("démarre sans bascule", async () => {
    const store = await chargerStore();
    expect(store.basculeSecoursActive()).toBe(false);
  });

  it("signaler mémorise pour la session", async () => {
    const store = await chargerStore();
    store.signalerBasculeSecours();
    expect(store.basculeSecoursActive()).toBe(true);
  });

  it("annuler rend le lecteur natif", async () => {
    const store = await chargerStore();
    store.signalerBasculeSecours();
    store.annulerBasculeSecours();
    expect(store.basculeSecoursActive()).toBe(false);
  });
});
