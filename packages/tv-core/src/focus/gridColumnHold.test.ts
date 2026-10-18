import { describe, expect, it } from "vitest";
import { GRID_COLUMN_HOLD_START, GRID_COLUMN_RETURN_MS, gridColumnHoldFocus, gridColumnHoldSettle, type GridColumnHoldState } from "./gridColumnHold";

/** Une grille de 5 colonnes et 1 200 affiches (le jeu « grande bibliothèque » du banc : 420 → 425 → 430). */
const COLUMNS = 5;
const COUNT = 1_200;

/** Une suite de focus (`null` : hors de la grille), un toutes les 100 ms depuis `from`, depuis `state`. */
const walk = (state: GridColumnHoldState, indexes: Array<number | null>, count = COUNT, from = 0) =>
  indexes.reduce((s, index, i) => gridColumnHoldFocus(s, index, COLUMNS, count, from + i * 100), state);
const settle = (state: GridColumnHoldState, count = COUNT) => gridColumnHoldSettle(state, COLUMNS, count);

describe("gridColumnHold — la colonne tenue pas à pas", () => {
  it("l'entrée dans la grille fixe la colonne ; posée là, rien à corriger", () => {
    const state = walk(GRID_COLUMN_HOLD_START, [2]);
    expect(state.column).toBe(2);
    expect(settle(state).correct).toBeNull();
  });

  it("un pas BAS dans la même colonne : rien à faire", () => {
    expect(settle(walk(GRID_COLUMN_HOLD_START, [2, 7])).correct).toBeNull();
  });

  it("un focus arrivé dans une autre ligne et une autre colonne est rendu à SA ligne, la grille posée", () => {
    expect(settle(walk(GRID_COLUMN_HOLD_START, [2, 420])).correct).toBe(422);
  });

  it("rien ne se corrige tant que la grille bouge : les focus ne font que suivre", () => {
    const state = walk(GRID_COLUMN_HOLD_START, [2, 60, 186, 300]);
    expect(state.column).toBe(2);
    expect(state.focused).toBe(300);
  });

  it("un pas GAUCHE ou DROITE (la même ligne) change la colonne retenue, sans attendre d'intention", () => {
    const state = walk(GRID_COLUMN_HOLD_START, [2, 1]);
    expect(state.column).toBe(1);
    expect(settle(walk(state, [420])).correct).toBe(421);
  });
});

describe("gridColumnHold — le défilement accéléré (flèche tenue)", () => {
  it("relevé du testeur : colonne 3 (grid:2), BAS tenu, arrivée en colonne 1 (425) → 427 à l'arrêt", () => {
    expect(settle(walk(GRID_COLUMN_HOLD_START, [2, 60, 186, 300, 425])).correct).toBe(427);
  });

  it("colonne 4 (grid:428), BAS tenu → 585 rendu en 588 ; HAUT tenu → 420 rendu en 423", () => {
    expect(settle(walk(GRID_COLUMN_HOLD_START, [428, 585])).correct).toBe(588);
    expect(settle(walk(GRID_COLUMN_HOLD_START, [428, 420])).correct).toBe(423);
  });

  it("une fois corrigée, la grille posée de nouveau ne refait rien", () => {
    const first = settle(walk(GRID_COLUMN_HOLD_START, [2, 425]));
    expect(first.correct).toBe(427);
    expect(settle(walk(first.state, [427])).correct).toBeNull();
  });
});

describe("gridColumnHold — HAUT tenu jusqu'en haut, et les filtres", () => {
  it("tvOS traverse les filtres au bout de sa course puis revient sur la 1re ligne : la colonne tient (grid:123 → grid:3)", () => {
    const state = walk(GRID_COLUMN_HOLD_START, [123, 60, null, 0]);
    expect(state.column).toBe(3);
    expect(settle(state).correct).toBe(3);
  });

  it("même si la grille paraît posée pendant le passage dans les filtres (machine chargée), le retour rapide garde la colonne", () => {
    let state = walk(GRID_COLUMN_HOLD_START, [123, 60, null]);
    state = settle(state).state; // une pause de plus de 300 ms, le focus dans les filtres
    state = gridColumnHoldFocus(state, 0, COLUMNS, COUNT, 900);
    expect(settle(state).correct).toBe(3);
  });

  it("relevé intermittent : une longue séance, puis HAUT tenu depuis grid:259 (col 5) → grid:4, jamais grid:0", () => {
    // grid:13 → BAS → 168 → HAUT jusqu'en haut (par les filtres) → corrigé en 3 → BAS, DROITE → 9 → BAS → 259.
    let state = walk(GRID_COLUMN_HOLD_START, [13, 168, null, 0]);
    const corrected = settle(state);
    expect(corrected.correct).toBe(3);
    state = walk(corrected.state, [3, 8, 9, 259]);
    expect(settle(state).correct).toBeNull();
    // HAUT tenu 4 s : par les filtres, retour en grid:0 — rien ne se corrige avant l'arrêt.
    state = walk(state, [130, 5, null, 0]);
    expect(settle(state).correct).toBe(4);
  });

  it("arrêté dans les filtres : rien à corriger ; BAS plus tard depuis une pastille est une nouvelle entrée, au plus proche", () => {
    const stopped = settle(walk(GRID_COLUMN_HOLD_START, [123, 60, null]));
    expect(stopped.correct).toBeNull();
    const back = gridColumnHoldFocus(stopped.state, 1, COLUMNS, COUNT, 200 + GRID_COLUMN_RETURN_MS + 1);
    expect(back.column).toBe(1);
    expect(settle(back).correct).toBeNull();
  });

  it("un index hors du catalogue vaut hors de la grille", () => {
    expect(walk(GRID_COLUMN_HOLD_START, [2, COUNT]).leftAt).not.toBeNull();
  });
});

describe("gridColumnHold — la dernière ligne, plus courte", () => {
  it("entrée par sa dernière affiche : juste, et sa colonne devient la retenue", () => {
    // 17 affiches : la dernière ligne a 15 et 16 (colonnes 0 et 1).
    const step = settle(walk(GRID_COLUMN_HOLD_START, [13, 16], 17), 17);
    expect(step.correct).toBeNull();
    expect(step.state.column).toBe(1);
  });

  it("une colonne qu'elle n'a pas : rendue à sa dernière affiche, jamais au-delà", () => {
    expect(settle(walk(GRID_COLUMN_HOLD_START, [13, 15], 17), 17).correct).toBe(16);
  });
});
