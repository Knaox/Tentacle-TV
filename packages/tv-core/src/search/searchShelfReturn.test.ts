import { describe, expect, it } from "vitest";
import { SEARCH_BAR_CLAIMS_MS, SEARCH_SHELF_RETURN_MS, SHELF_RETURN_IDLE, shelfReturnStep } from "./searchShelfReturn";

describe("retour d'une étagère", () => {
  it("rend la barre à l'arrivée, et arme la fin de la fenêtre", () => {
    const left = shelfReturnStep(SHELF_RETURN_IDLE, { type: "leave" });
    expect(left.state.browsing).toBe(true);
    const back = shelfReturnStep(left.state, { type: "arrive", closing: false });
    expect(back.effects).toEqual([{ type: "focusBar" }, { type: "armSettle", ms: SEARCH_SHELF_RETURN_MS }]);
  });

  it("une seconde arrivée dans la fenêtre reprend encore la barre", () => {
    let state = shelfReturnStep(SHELF_RETURN_IDLE, { type: "leave" }).state;
    state = shelfReturnStep(state, { type: "arrive", closing: false }).state;
    expect(shelfReturnStep(state, { type: "arrive", closing: false }).effects[0]).toEqual({ type: "focusBar" });
  });

  it("la fenêtre passée, une arrivée ne touche à rien", () => {
    let state = shelfReturnStep(SHELF_RETURN_IDLE, { type: "leave" }).state;
    state = shelfReturnStep(state, { type: "settle" }).state;
    expect(shelfReturnStep(state, { type: "arrive", closing: false }).effects).toEqual([]);
  });

  it("une transition de départ (`closing`) ne pose rien", () => {
    const state = shelfReturnStep(SHELF_RETURN_IDLE, { type: "leave" }).state;
    expect(shelfReturnStep(state, { type: "arrive", closing: true }).effects).toEqual([]);
  });

  it("sans étagère ouverte, une arrivée ne pose rien (lecteur, fiche refermés)", () => {
    expect(shelfReturnStep(SHELF_RETURN_IDLE, { type: "arrive", closing: false }).effects).toEqual([]);
  });

  it("la barre se pose en deux temps : tout de suite, puis 400 ms plus tard", () => {
    expect(SEARCH_BAR_CLAIMS_MS).toEqual([0, 400]);
  });
});
