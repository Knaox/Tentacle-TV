import { describe, expect, it } from "vitest";
import { CARD_SIZE_GRID_COLUMNS, CARD_SIZE_SCALE, CARD_SIZES } from "./cardSize";
import {
  GRID_PREVIEW_SETTLE_MS,
  GRID_PREVIEW_SPAN,
  gridFocusOutrun,
  gridPreviewSettleDelay,
  gridTrailerPreviewPlace,
  gridTrailerPreviewSpread,
  gridTrailerPreviewWarmWindow,
} from "./trailerPreviewGrid";
import { trailerPreviewTileSize } from "./trailerPreviewTile";

/** La grille de la scène (`PosterGrid`), recopiée : ce test ne dépend pas du thème. */
const GRID_WIDTH = 1920 - 176 - 96;
const GAP = 36;
const FOCUS_SCALE = 1.08;
const LIFT = 4;
/** La légende d'une affiche de grille (titre, année), au repos. */
const CAPTION = 72;

const posterWidth = (columns: number) => Math.floor((GRID_WIDTH - GAP * (columns - 1)) / columns);

/** La grande carte d'une affiche à la colonne `column`, à la taille des cartes `size`. */
function placeAt(column: number, columns: number, focusScale = FOCUS_SCALE, lift = LIFT) {
  const cardWidth = posterWidth(columns);
  const cardHeight = Math.round(cardWidth * 1.5);
  const captionBottom = cardHeight + (cardHeight * (focusScale - 1)) / 2 + CAPTION;
  return gridTrailerPreviewPlace({ column, columns, cardWidth, cardHeight, gap: GAP, focusScale, lift, captionBottom });
}

describe("gridTrailerPreviewSpread — la ligne fait place à sa grande carte", () => {
  it("à gauche de l'écran, la grande carte s'étend à droite : les suivantes glissent de deux colonnes", () => {
    expect(gridTrailerPreviewSpread({ column: 0, columns: 6 })).toEqual({
      first: 0,
      offsets: [0, 2, 2, 2, 2, 2],
      hidden: [false, false, false, false, false, false],
    });
    expect(gridTrailerPreviewSpread({ column: 3, columns: 6 }).offsets).toEqual([0, 0, 0, 0, 2, 2]);
  });

  it("près du bord droit, elle s'arrête à la dernière colonne : ce qui est à gauche glisse d'autant", () => {
    expect(gridTrailerPreviewSpread({ column: 4, columns: 6 })).toEqual({
      first: 3,
      offsets: [-1, -1, -1, -1, 0, 1],
      hidden: [true, false, false, false, false, false],
    });
    expect(gridTrailerPreviewSpread({ column: 5, columns: 6 })).toEqual({
      first: 3,
      offsets: [-2, -2, -2, -2, -2, 0],
      hidden: [true, true, false, false, false, false],
    });
  });

  it("la grille garde ses colonnes : aucune affiche ne reste sous la grande carte", () => {
    for (const columns of [5, 6, 7]) {
      for (let column = 0; column < columns; column += 1) {
        const { first, offsets } = gridTrailerPreviewSpread({ column, columns });
        expect(first).toBeGreaterThanOrEqual(0);
        expect(first + GRID_PREVIEW_SPAN).toBeLessThanOrEqual(columns);
        expect(first).toBeLessThanOrEqual(column);
        offsets.forEach((offset, at) => {
          expect(Number.isInteger(offset)).toBe(true);
          if (at === column) return;
          const landing = at + offset;
          expect(landing < first || landing >= first + GRID_PREVIEW_SPAN).toBe(true);
        });
      }
    }
  });

  it("une voisine immédiate ne s'efface jamais : la flèche y mène depuis la grande carte", () => {
    // Trois colonnes : la voisine de gauche de la dernière sortirait par la gauche.
    expect(gridTrailerPreviewSpread({ column: 2, columns: 3 }).hidden).toEqual([true, false, false]);
    for (const columns of [3, 5, 6, 7]) {
      for (let column = 0; column < columns; column += 1) {
        const { hidden } = gridTrailerPreviewSpread({ column, columns });
        if (column > 0) expect(hidden[column - 1]).toBe(false);
        if (column < columns - 1) expect(hidden[column + 1]).toBe(false);
      }
    }
  });

  it("une colonne hors de la grille est ramenée dans ses bornes", () => {
    expect(gridTrailerPreviewSpread({ column: 9, columns: 6 }).first).toBe(3);
    expect(gridTrailerPreviewSpread({ column: -2, columns: 6 }).first).toBe(0);
    expect(gridTrailerPreviewSpread({ column: 0, columns: 2 }).first).toBe(0);
  });
});

describe("gridTrailerPreviewPlace — la grande carte d'une affiche de grille", () => {
  it("trois colonnes en 16:9 — la taille de celle des rangées, en taille normale", () => {
    const { tile } = placeAt(0, 6);
    expect(tile).toEqual({ width: 804, height: 452 });
    const row = trailerPreviewTileSize({ cardWidth: 244, cardHeight: 366, screenWidth: 1920, maxWidth: GRID_WIDTH });
    expect(Math.abs(tile.width - row.width)).toBeLessThanOrEqual(4);
  });

  it("suit le réglage « Taille des cartes » : plus grande à chaque cran", () => {
    const widths = CARD_SIZES.map((size) => placeAt(0, CARD_SIZE_GRID_COLUMNS[size]).tile.width);
    expect(widths).toEqual([684, 804, 972]);
    // Au plus 10 % de moins que la grande carte d'une rangée, à la même taille.
    CARD_SIZES.forEach((size, at) => {
      const row = trailerPreviewTileSize({ cardWidth: 244, cardHeight: 366, screenWidth: 1920, maxWidth: GRID_WIDTH, sizeScale: CARD_SIZE_SCALE[size] });
      expect(widths[at]).toBeGreaterThanOrEqual(row.width * 0.9);
    });
  });

  it("part de l'affiche telle qu'elle se dessine au focus : agrandie depuis son centre, soulevée", () => {
    const { from } = placeAt(2, 6);
    expect(from.left).toBeCloseTo(-9.76, 2);
    expect(from.top).toBeCloseTo(-14.64 - LIFT, 2);
    expect(from.width).toBeCloseTo(263.52, 2);
    expect(from.height).toBeCloseTo(395.28, 2);
    // Sans agrandissement (mode Lite) : l'affiche au repos.
    expect(placeAt(2, 6, 1, 0).from).toEqual({ left: 0, top: 0, width: 244, height: 366 });
  });

  it("s'étend à droite de sa cellule, ou s'arrête à la dernière colonne", () => {
    expect(placeAt(0, 6).to.left).toBe(0);
    expect(placeAt(3, 6).to.left).toBe(0);
    expect(placeAt(4, 6).to.left).toBe(-280);
    expect(placeAt(5, 6).to.left).toBe(-560);
    // Jamais au-delà de la marge de droite.
    for (const columns of [5, 6, 7]) {
      for (let column = 0; column < columns; column += 1) {
        const place = placeAt(column, columns);
        const cellLeft = 176 + column * (posterWidth(columns) + GAP);
        expect(cellLeft + place.to.left).toBeGreaterThanOrEqual(176);
        expect(cellLeft + place.to.left + place.tile.width).toBeLessThanOrEqual(1920 - 96 + 1);
      }
    }
  });

  it("reste dans la bande de sa ligne : finit au bas de la légende, mord peu au-dessus", () => {
    for (const size of CARD_SIZES) {
      for (const [scale, lift] of [[FOCUS_SCALE, LIFT], [1, 0]] as const) {
        const columns = CARD_SIZE_GRID_COLUMNS[size];
        const place = placeAt(1, columns, scale, lift);
        const cardHeight = Math.round(posterWidth(columns) * 1.5);
        const captionBottom = cardHeight + (cardHeight * (scale - 1)) / 2 + CAPTION;
        expect(place.to.top + place.tile.height).toBeCloseTo(captionBottom, 5);
        // L'écart entre deux lignes est de 52 points : elle n'en prend jamais la moitié.
        expect(place.to.top).toBeGreaterThan(-26);
        // Plus haute que l'affiche focalisée : elle ne rapetisse jamais.
        expect(place.tile.height).toBeGreaterThan(place.from.height);
      }
    }
  });
});

describe("gridTrailerPreviewWarmWindow — la préparation autour du focus, bornée", () => {
  it("la ligne de la carte focalisée et la suivante", () => {
    expect(gridTrailerPreviewWarmWindow(8, 100, 6)).toEqual([6, 18]);
    expect(gridTrailerPreviewWarmWindow(6, 100, 6)).toEqual([6, 18]);
  });

  it("bornée à la fin du catalogue, et à deux lignes quelle que soit sa taille", () => {
    expect(gridTrailerPreviewWarmWindow(95, 100, 6)).toEqual([90, 100]);
    expect(gridTrailerPreviewWarmWindow(0, 0, 6)).toEqual([0, 0]);
    for (const columns of [5, 6, 7]) {
      for (const index of [0, 37, 499, 999]) {
        const [start, end] = gridTrailerPreviewWarmWindow(index, 1_000, columns);
        expect(end - start).toBeLessThanOrEqual(2 * columns);
        expect(index).toBeGreaterThanOrEqual(start);
        expect(index).toBeLessThan(end);
      }
    }
  });
});

describe("gridPreviewSettleDelay — rien tant que la grille bouge", () => {
  it("posée sans aucun mouvement, ou passé le délai depuis le dernier", () => {
    expect(gridPreviewSettleDelay(null, 1_000)).toBe(0);
    expect(gridPreviewSettleDelay(1_000, 1_000 + GRID_PREVIEW_SETTLE_MS)).toBe(0);
  });

  it("un défilement qui continue repousse toujours le moment où elle est posée", () => {
    // Flèche tenue : focus rares, défilement continu (un évènement toutes les 100 ms).
    for (let at = 0; at <= 8_000; at += 100) expect(gridPreviewSettleDelay(at, at + 100)).toBe(GRID_PREVIEW_SETTLE_MS - 100);
    expect(gridPreviewSettleDelay(8_000, 8_050)).toBe(250);
  });
});

describe("gridFocusOutrun — un focus dépassé par la page", () => {
  const stride = 366 + 67 + 52;
  it("un pas de flèche (au plus une ligne) ne retient rien", () => {
    expect(gridFocusOutrun(0, stride, stride)).toBe(false);
    expect(gridFocusOutrun(2_000, 2_000 - stride, stride)).toBe(false);
  });

  it("le défilement accéléré, loin du focus connu, le retient — dans les deux sens", () => {
    expect(gridFocusOutrun(0, 2 * stride, stride)).toBe(true);
    expect(gridFocusOutrun(5_000, 5_000 - 1.6 * stride, stride)).toBe(true);
  });
});
