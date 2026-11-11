/**
 * L'invariant tenu ici : la bascule de secours est une mémoire de SESSION —
 * elle ne s'écrit que par `reportFallbackSwitch`, et l'erreur de MÉDIA
 * (fichier local disparu) ne l'écrit JAMAIS : c'est tout l'objet du
 * classement de `hooks/playbackFailure.ts`. Le store est un module à état :
 * chaque test recharge le module pour repartir à zéro.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

async function loadStore() {
  return import("./fallbackPlayer");
}

describe("fallbackPlayer", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("démarre sans bascule", async () => {
    const store = await loadStore();
    expect(store.isFallbackActive()).toBe(false);
  });

  it("signaler mémorise pour la session", async () => {
    const store = await loadStore();
    store.reportFallbackSwitch();
    expect(store.isFallbackActive()).toBe(true);
  });

  it("annuler rend le lecteur natif", async () => {
    const store = await loadStore();
    store.reportFallbackSwitch();
    store.cancelFallbackSwitch();
    expect(store.isFallbackActive()).toBe(false);
  });
});

describe("le relais de la position", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("la bascule emporte le titre et la position de l'arrêt : le lecteur web reprend là", async () => {
    const store = await loadStore();
    store.reportFallbackSwitch({ itemId: "film", positionSeconds: 1234.5 });
    expect(store.isFallbackActive()).toBe(true);
    expect(store.fallbackHandoverFor("film")).toBe(1234.5);
  });

  it("il ne vaut que pour CE titre", async () => {
    const store = await loadStore();
    store.reportFallbackSwitch({ itemId: "film", positionSeconds: 60 });
    expect(store.fallbackHandoverFor("autre")).toBeUndefined();
    expect(store.fallbackHandoverFor(undefined)).toBeUndefined();
  });

  it("une lecture qui n'avait pas commencé (position nulle) ne passe aucun relais", async () => {
    const store = await loadStore();
    store.reportFallbackSwitch({ itemId: "film", positionSeconds: 0 });
    expect(store.fallbackHandoverFor("film")).toBeUndefined();
    store.reportFallbackSwitch();
    expect(store.fallbackHandoverFor("film")).toBeUndefined();
  });

  it("passé, il s'oublie : rouvrir le titre reprend comme toujours — et la bascule reste", async () => {
    const store = await loadStore();
    store.reportFallbackSwitch({ itemId: "film", positionSeconds: 60 });
    store.settleFallbackHandover("autre");
    expect(store.fallbackHandoverFor("film")).toBe(60);
    store.settleFallbackHandover("film");
    expect(store.fallbackHandoverFor("film")).toBeUndefined();
    expect(store.isFallbackActive()).toBe(true);
  });

  it("une bascule sans relais efface celui d'avant", async () => {
    const store = await loadStore();
    store.reportFallbackSwitch({ itemId: "film", positionSeconds: 60 });
    store.reportFallbackSwitch();
    expect(store.fallbackHandoverFor("film")).toBeUndefined();
  });
});
