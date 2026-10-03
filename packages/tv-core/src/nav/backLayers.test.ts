import { describe, expect, it, vi } from "vitest";

import { createBackLayers, railBackStep, type BackLayerKind } from "./backLayers";

/** Une couche qui note ses Retours dans `log`. */
function layer(kind: BackLayerKind, active: boolean, log: string[], name: string) {
  return { kind, active, onBack: () => log.push(name) };
}

describe("createBackLayers — la pile de couches du Retour", () => {
  it("sans couche active, rien n'est pris : la plateforme agit (la sortie)", () => {
    const layers = createBackLayers();
    const log: string[] = [];
    layers.set("page", layer("page", false, log, "page"));
    expect(layers.target()).toBeNull();
    expect(layers.back()).toBe(false);
    expect(log).toEqual([]);
  });

  it("consulte menu > surimpression > page > rail, quel que soit l'ordre d'inscription", () => {
    const layers = createBackLayers();
    const log: string[] = [];
    layers.set("rail", layer("rail", true, log, "rail"));
    layers.set("page", layer("page", true, log, "page"));
    layers.set("osd", layer("overlay", true, log, "osd"));
    layers.set("pistes", layer("menu", true, log, "pistes"));
    expect(layers.target()).toEqual({ id: "pistes", kind: "menu" });
    layers.back();
    expect(log).toEqual(["pistes"]);
  });

  it("le lecteur : menu, puis surimpression, puis la sortie de la lecture", () => {
    const layers = createBackLayers();
    const log: string[] = [];
    const set = (tracks: boolean, osd: boolean) => {
      layers.set("pistes", layer("menu", tracks, log, "ferme les pistes"));
      layers.set("osd", layer("overlay", osd, log, "masque la surimpression"));
      layers.set("lecteur", layer("page", true, log, "quitte la lecture"));
    };
    set(true, true);
    layers.back();
    set(false, true);
    layers.back();
    set(false, false);
    layers.back();
    expect(log).toEqual(["ferme les pistes", "masque la surimpression", "quitte la lecture"]);
  });

  it("à rang égal, la plus récemment ACTIVÉE répond la première", () => {
    const layers = createBackLayers();
    const log: string[] = [];
    layers.set("panneau", layer("menu", false, log, "panneau"));
    layers.set("feuille", layer("menu", false, log, "feuille"));
    layers.set("feuille", layer("menu", true, log, "feuille"));
    layers.set("panneau", layer("menu", true, log, "panneau"));
    expect(layers.target()?.id).toBe("panneau");
  });

  it("une couche active mise à jour garde son rang", () => {
    const layers = createBackLayers();
    const log: string[] = [];
    layers.set("a", layer("menu", true, log, "a"));
    layers.set("b", layer("menu", true, log, "b"));
    layers.set("a", layer("menu", true, log, "a, nouveau gestionnaire"));
    layers.back();
    expect(log).toEqual(["b"]);
  });

  it("une couche qui CHANGE DE RANG garde son rang d'activation (même identifiant)", () => {
    const layers = createBackLayers();
    const log: string[] = [];
    layers.set("a", layer("page", true, log, "a"));
    layers.set("b", layer("menu", true, log, "b"));
    // `a` devient un menu sans avoir été désactivée : elle reste plus ANCIENNE que `b`.
    layers.set("a", layer("menu", true, log, "a"));
    expect(layers.target()).toEqual({ id: "b", kind: "menu" });
    layers.back();
    expect(log).toEqual(["b"]);
  });

  it("le gestionnaire appelé est le DERNIER inscrit", () => {
    const layers = createBackLayers();
    const log: string[] = [];
    layers.set("a", layer("menu", true, log, "ancien"));
    layers.set("a", layer("menu", true, log, "nouveau"));
    layers.back();
    expect(log).toEqual(["nouveau"]);
  });

  it("une couche retirée ne répond plus", () => {
    const layers = createBackLayers();
    const log: string[] = [];
    layers.set("menu", layer("menu", true, log, "menu"));
    layers.set("page", layer("page", true, log, "page"));
    layers.remove("menu");
    layers.back();
    expect(log).toEqual(["page"]);
  });

  it("prévient seulement quand la cible change", () => {
    const layers = createBackLayers();
    const listener = vi.fn();
    layers.subscribe(listener);
    const log: string[] = [];
    layers.set("page", layer("page", true, log, "page"));
    layers.set("page", layer("page", true, log, "page"));
    layers.set("rail", layer("rail", true, log, "rail"));
    expect(listener).toHaveBeenCalledTimes(1);
    layers.set("page", layer("page", false, log, "page"));
    expect(listener).toHaveBeenCalledTimes(2);
    expect(layers.target()?.id).toBe("rail");
    layers.remove("rail");
    expect(listener).toHaveBeenCalledTimes(3);
    expect(layers.target()).toBeNull();
  });
});

describe("railBackStep — Retour sur une page du rail", () => {
  it("depuis la page : le rail s'ouvre", () => {
    expect(railBackStep({ railFocused: false, onSettings: false })).toBe("openRail");
  });

  it("rail ouvert : le focus va sur Réglages", () => {
    expect(railBackStep({ railFocused: true, onSettings: false })).toBe("toSettings");
  });

  it("déjà sur Réglages : la sortie", () => {
    expect(railBackStep({ railFocused: true, onSettings: true })).toBe("exit");
  });
});
