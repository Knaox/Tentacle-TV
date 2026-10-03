import { describe, expect, it } from "vitest";

import { resolveBack } from "./backResolve";
import { REQUESTS_CLOSE_GUARDED, REQUESTS_VISIBLE_ROWS, requestsDockLocked, requestsPanelBackLayers, requestsRowsFocusable } from "./railRequests";

describe("railRequests — les demandes dans le rail", () => {
  it("les lignes de la fenêtre : focalisables seulement au-delà de quatre", () => {
    expect(REQUESTS_VISIBLE_ROWS).toBe(4);
    expect(requestsRowsFocusable(0)).toBe(false);
    expect(requestsRowsFocusable(4)).toBe(false);
    expect(requestsRowsFocusable(5)).toBe(true);
  });

  it("l'aperçu est verrouillé pendant un déplacement", () => {
    expect(requestsDockLocked(true)).toBe(true);
    expect(requestsDockLocked(false)).toBe(false);
  });

  it("la croix est gardée du clic fantôme", () => {
    expect(REQUESTS_CLOSE_GUARDED).toBe(true);
  });

  it("Retour ferme la fenêtre ; sortie lancée, la couche se retire", () => {
    expect(resolveBack(requestsPanelBackLayers(false), { pushed: false })).toEqual({ kind: "layer", id: "close", action: "close" });
    expect(resolveBack(requestsPanelBackLayers(true), { pushed: false })).toEqual({ kind: "exit" });
  });
});
