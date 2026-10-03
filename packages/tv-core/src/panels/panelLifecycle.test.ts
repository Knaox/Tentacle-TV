import { describe, expect, it } from "vitest";
import { resolveBack } from "../nav/backResolve";
import { MODAL_GAP_MS, closesAtOnce, panelBackLayers, panelPresented } from "./panelLifecycle";

describe("le Retour d'un panneau", () => {
  it("est une couche « menu » qui le ferme, active dès l'ouverture", () => {
    expect(panelBackLayers("card", false)).toEqual([{ id: "panel:card", kind: "menu", active: true, action: "close" }]);
    expect(panelBackLayers("seasons", false)[0].active).toBe(true);
  });

  it("se coupe pendant la sortie du grand panneau et de la feuille des saisons", () => {
    expect(panelBackLayers("card", true)[0].active).toBe(false);
    expect(panelBackLayers("seasons", true)[0].active).toBe(false);
  });

  it("reste active pendant la sortie du panneau d'un titre absent", () => {
    expect(panelBackLayers("absent", true)[0].active).toBe(true);
  });

  it("ferme le panneau ouvert avant que la page recule ; en sortie, sa couche ne prend plus Retour (une Modal présentée le reçoit encore elle-même)", () => {
    expect(resolveBack(panelBackLayers("card", false), { pushed: true })).toEqual({ kind: "layer", id: "panel:card", action: "close" });
    expect(resolveBack(panelBackLayers("card", true), { pushed: true })).toEqual({ kind: "pop" });
    expect(resolveBack(panelBackLayers("seasons", true), { pushed: false })).toEqual({ kind: "exit" });
    expect(resolveBack(panelBackLayers("absent", true), { pushed: false })).toEqual({ kind: "layer", id: "panel:absent", action: "close" });
  });
});

describe("la présentation d'un panneau", () => {
  it("attend son entrée", () => {
    expect(panelPresented(null)).toBe(false);
    expect(panelPresented("sheet:scale:5")).toBe(true);
  });

  it("fermé avant d'avoir paru : la feuille des saisons part tout de suite, les autres jouent leur sortie", () => {
    expect(closesAtOnce("seasons", false)).toBe(true);
    expect(closesAtOnce("seasons", true)).toBe(false);
    expect(closesAtOnce("card", false)).toBe(false);
    expect(closesAtOnce("absent", false)).toBe(false);
  });

  it("deux Modal qui se suivent laissent un écart", () => {
    expect(MODAL_GAP_MS).toBe(320);
  });
});
