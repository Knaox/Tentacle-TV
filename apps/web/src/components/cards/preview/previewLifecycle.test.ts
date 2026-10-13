import { describe, expect, it } from "vitest";
import {
  OPEN_GATE,
  engineHovered,
  gateAfterClose,
  gateAfterInputs,
  previewClosingFor,
  previewStage,
  previewTabMove,
  type PreviewGate,
} from "./previewLifecycle";

/**
 * La vie de la mini-carte : quand elle se montre, comment elle se ferme, où
 * va le focus. Règles pures — les écouteurs de `usePreviewListeners` ne font
 * que les appliquer.
 */

const base = { hovered: true, hasSubject: true, disabled: false, gate: OPEN_GATE, keyboardInCard: false };

describe("previewStage — montée cachée, puis vue", () => {
  const stage = (over: Partial<Parameters<typeof previewStage>[0]> = {}) =>
    previewStage({ engineMounted: true, engineVisible: true, gate: OPEN_GATE, placed: true, revealed: true, ...over });

  it("rien tant que le moteur n'a pas de vidéo (pas de bande-annonce, erreur, intention pas encore passée)", () => {
    expect(stage({ engineMounted: false, engineVisible: false })).toEqual({ mounted: false, shown: false });
  });

  it("préchargement : montée (cachée) dès que la vidéo existe, jamais vue avant que le moteur la montre", () => {
    expect(stage({ engineVisible: false, revealed: false })).toEqual({ mounted: true, shown: false });
  });

  it("vue seulement placée ET révélée : la transition a toujours un point de départ", () => {
    expect(stage({ revealed: false })).toEqual({ mounted: true, shown: false });
    expect(stage({ placed: false })).toEqual({ mounted: false, shown: false });
    expect(stage()).toEqual({ mounted: true, shown: true });
  });

  it("erreur ou fin après l'apparition : le moteur la retire, elle reste montée le temps de sa sortie", () => {
    expect(stage({ engineVisible: false })).toEqual({ mounted: true, shown: false });
  });

  it("fermée en douceur : elle sort ; fermée net : elle n'est plus rendue du tout", () => {
    expect(stage({ gate: { dismissed: true, cut: false } })).toEqual({ mounted: true, shown: false });
    expect(stage({ gate: { dismissed: true, cut: true } })).toEqual({ mounted: false, shown: false });
  });
});

describe("previewClosingFor — défilement net, le reste en douceur", () => {
  it("ferme NET ce qui fait bouger la page sous la mini-carte fixée", () => {
    expect(previewClosingFor("scroll")).toBe("dry");
    expect(previewClosingFor("wheel")).toBe("dry");
    expect(previewClosingFor("resize")).toBe("dry");
  });

  it("ferme EN DOUCEUR Échap, un clic ailleurs, la fenêtre quittée", () => {
    expect(previewClosingFor("escape")).toBe("soft");
    expect(previewClosingFor("pointer-outside")).toBe("soft");
    expect(previewClosingFor("window-blur")).toBe("soft");
  });
});

describe("la porte — fermée jusqu'à la fin du survol", () => {
  it("un défilement ferme et coupe ; le moteur et la carte la rouvrent ensuite", () => {
    let gate: PreviewGate = gateAfterClose(OPEN_GATE, previewClosingFor("scroll"));
    expect(gate).toEqual({ dismissed: true, cut: true });
    // Toujours survolée, vidéo encore montée (fondu du moteur) : rien ne revient.
    gate = gateAfterInputs(gate, { hovered: true, engineMounted: true });
    expect(gate).toEqual({ dismissed: true, cut: true });
    expect(engineHovered({ ...base, gate })).toBe(false);
    // La vidéo démontée lève la coupure ; la fin du survol rouvre la porte.
    gate = gateAfterInputs(gate, { hovered: true, engineMounted: false });
    expect(gate).toEqual({ dismissed: true, cut: false });
    gate = gateAfterInputs(gate, { hovered: false, engineMounted: false });
    expect(gate).toEqual(OPEN_GATE);
  });

  it("Échap ferme sans couper : la sortie animée se joue", () => {
    expect(gateAfterClose(OPEN_GATE, "soft")).toEqual({ dismissed: true, cut: false });
  });

  it("rend le MÊME objet quand rien ne change (aucun rendu de plus)", () => {
    const gate = { dismissed: true, cut: false };
    expect(gateAfterInputs(gate, { hovered: true, engineMounted: true })).toBe(gate);
    expect(gateAfterInputs(OPEN_GATE, { hovered: false, engineMounted: false })).toBe(OPEN_GATE);
  });
});

describe("engineHovered — ce que voit le moteur", () => {
  it("le survol de la carte, quand rien ne l'interdit", () => {
    expect(engineHovered(base)).toBe(true);
    expect(engineHovered({ ...base, hovered: false })).toBe(false);
  });

  it("rien pour une carte sans bande-annonce possible, ou un aperçu coupé (menu, sélection)", () => {
    expect(engineHovered({ ...base, hasSubject: false })).toBe(false);
    expect(engineHovered({ ...base, disabled: true })).toBe(false);
  });

  it("attend que le focus clavier quitte le plateau de la carte", () => {
    expect(engineHovered({ ...base, keyboardInCard: true })).toBe(false);
  });
});

describe("previewTabMove — la mini-carte insérée dans le parcours, juste après sa carte", () => {
  it("Tab depuis la carte entre dans la mini-carte ; Maj+Tab depuis la carte suit le navigateur", () => {
    expect(previewTabMove("owner", false)).toBe("enter-preview");
    expect(previewTabMove("owner", true)).toBeNull();
  });

  it("Tab depuis le dernier bouton reprend après la carte ; Maj+Tab depuis le premier revient sur elle", () => {
    expect(previewTabMove("preview-last", false)).toBe("after-card");
    expect(previewTabMove("preview-first", true)).toBe("back-to-owner");
    expect(previewTabMove("preview-only", false)).toBe("after-card");
    expect(previewTabMove("preview-only", true)).toBe("back-to-owner");
  });

  it("entre deux boutons de la mini-carte, et partout ailleurs, le navigateur fait son travail", () => {
    expect(previewTabMove("preview-first", false)).toBeNull();
    expect(previewTabMove("preview-last", true)).toBeNull();
    expect(previewTabMove("preview-middle", false)).toBeNull();
    expect(previewTabMove("elsewhere", false)).toBeNull();
  });
});
