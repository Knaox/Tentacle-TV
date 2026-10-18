import { describe, expect, it } from "vitest";
import { GRID_COLUMN_HOLD_START, gridColumnHoldFocus, gridColumnHoldKey, gridColumnHoldRelease, type GridColumnHoldState } from "./gridColumnHold";

/** Une grille de 5 colonnes et 1 200 affiches (le jeu « grande bibliothèque » du banc : 420 → 425 → 430). */
const COLUMNS = 5;
const COUNT = 1_200;

const focus = (state: GridColumnHoldState, index: number | null, count = COUNT) => gridColumnHoldFocus(state, index, COLUMNS, count);
const key = (state: GridColumnHoldState, k: "haut" | "bas" | "gauche" | "select", phase: "start" | "update" | "end") => gridColumnHoldKey(state, k, phase, COLUMNS, COUNT);

/** Entrée dans la grille sur `index`. */
const enter = (index: number) => focus(GRID_COLUMN_HOLD_START, index).state;

describe("gridColumnHold — la colonne tenue pas à pas", () => {
  it("l'entrée dans la grille fixe la colonne, sans rien corriger", () => {
    const step = focus(GRID_COLUMN_HOLD_START, 2);
    expect(step.correct).toBeNull();
    expect(step.state.column).toBe(2);
  });

  it("un pas BAS dans la même colonne : rien à faire", () => {
    expect(focus(enter(2), 7).correct).toBeNull();
  });

  it("un focus arrivé dans une autre colonne par HAUT ou BAS est rendu à SA ligne, dans la colonne retenue", () => {
    // Colonne 3 (index 2), arrivée en colonne 1 de la ligne 70 (index 420).
    expect(focus(enter(2), 420).correct).toBe(422);
  });

  it("un pas GAUCHE ou DROITE (la même ligne) change la colonne retenue, sans attendre d'intention", () => {
    const step = focus(enter(2), 1);
    expect(step.correct).toBeNull();
    expect(step.state.column).toBe(1);
    // Puis BAS tenu : la nouvelle colonne est tenue.
    expect(focus(step.state, 420).correct).toBe(421);
  });
});

describe("gridColumnHold — le défilement accéléré (flèche tenue)", () => {
  it("relevé du testeur : colonne 3 (grid:2), BAS tenu 6 s, arrivée en colonne 1 (425) → rendue en colonne 3 au lâcher, jamais pendant", () => {
    let state = key(enter(2), "bas", "start").state;
    for (const index of [60, 186, 300, 425]) {
      const step = focus(state, index);
      expect(step.correct).toBeNull();
      state = step.state;
    }
    const released = key(state, "bas", "end");
    expect(released.correct).toBe(427);
    expect(released.state.held).toBe(false);
  });

  it("colonne 4 (grid:428), BAS tenu, arrivée en colonne 1 (585) → 588 ; HAUT tenu, arrivée en 420 → 423", () => {
    let state = key(enter(428), "bas", "start").state;
    state = focus(state, 585).state;
    expect(key(state, "bas", "end").correct).toBe(588);
    state = key(enter(428), "haut", "start").state;
    state = focus(state, 420).state;
    expect(key(state, "haut", "end").correct).toBe(423);
  });

  it("un focus qui arrive APRÈS le lâcher (tvOS finit son mouvement) est corrigé à son arrivée", () => {
    const released = key(key(enter(2), "bas", "start").state, "bas", "end");
    expect(released.correct).toBeNull();
    expect(focus(released.state, 425).correct).toBe(427);
  });

  it("sans fin de maintien annoncée (Siri Remote), la grille POSÉE vaut le lâcher", () => {
    let state = key(enter(2), "bas", "start").state;
    state = focus(state, 425).state;
    const settled = gridColumnHoldRelease(state, COLUMNS, COUNT);
    expect(settled.correct).toBe(427);
    expect(settled.state.held).toBe(false);
  });

  it("posée sans écart (un pas simple, ou déjà corrigée) : rien à faire", () => {
    expect(gridColumnHoldRelease(focus(enter(2), 7).state, COLUMNS, COUNT).correct).toBeNull();
    expect(gridColumnHoldRelease(GRID_COLUMN_HOLD_START, COLUMNS, COUNT).correct).toBeNull();
  });

  it("un maintien d'OK ou de GAUCHE ne retient rien", () => {
    const state = enter(2);
    expect(key(state, "select", "start").state.held).toBe(false);
    expect(key(state, "gauche", "end").correct).toBeNull();
  });

  it("lâché dans la bonne colonne : rien à faire", () => {
    let state = key(enter(2), "bas", "start").state;
    state = focus(state, 427).state;
    expect(key(state, "bas", "end").correct).toBeNull();
  });
});

describe("gridColumnHold — les bords", () => {
  it("la dernière ligne, plus courte, entrée par sa dernière affiche : juste, et sa colonne devient la retenue", () => {
    // 17 affiches : la dernière ligne a 15 et 16 (colonnes 0 et 1).
    const state = focus(GRID_COLUMN_HOLD_START, 13, 17).state;
    const last = focus(state, 16, 17);
    expect(last.correct).toBeNull();
    expect(last.state.column).toBe(1);
  });

  it("une colonne que la dernière ligne n'a pas : rendue à sa dernière affiche, jamais au-delà", () => {
    expect(focus(focus(GRID_COLUMN_HOLD_START, 13, 17).state, 15, 17).correct).toBe(16);
  });

  it("HAUT tenu jusqu'en haut : tvOS traverse les filtres puis revient sur la 1re ligne — la colonne tient (grid:123 → grid:3)", () => {
    let state = key(enter(123), "haut", "start").state;
    state = focus(state, 60).state;
    state = focus(state, null).state; // les filtres, au bout de la course
    expect(state.column).toBe(3);
    const back = focus(state, 0);
    expect(back.correct).toBeNull(); // pas pendant le maintien
    expect(key(back.state, "haut", "end").correct).toBe(3);
  });

  it("lâché dans les filtres au bout d'un HAUT tenu : on y reste, plus rien n'est retenu", () => {
    let state = key(enter(123), "haut", "start").state;
    state = focus(state, null).state;
    const released = key(state, "haut", "end");
    expect(released.correct).toBeNull();
    expect(released.state).toEqual(GRID_COLUMN_HOLD_START);
  });

  it("hors de la grille (filtres, rail) : plus rien n'est retenu — on y revient au plus proche", () => {
    const out = focus(enter(2), null);
    expect(out.state).toEqual(GRID_COLUMN_HOLD_START);
    expect(focus(out.state, 3).correct).toBeNull();
  });

  it("un index hors du catalogue vaut hors de la grille", () => {
    expect(focus(enter(2), COUNT).state.column).toBeNull();
  });
});
