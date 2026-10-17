import { describe, expect, it } from "vitest";
import { CARD_SIZE_GRID_COLUMNS, CARD_SIZE_SCALE, CARD_SIZES } from "./cardSize";
import { GRID_PREVIEW_SETTLE_MS, gridFocusOutrun, gridPreviewSettleDelay, gridTrailerPreviewWarmWindow } from "./trailerPreviewGrid";
import { INITIAL_ROW_HEAD, reduceRowHead, type RowHeadContext } from "./trailerPreviewRowHead";
import { trailerPreviewTileSize } from "./trailerPreviewTile";

/** La grille de la scène (`PosterGrid`), recopiée : ce test ne dépend pas du thème. */
const INSET = 176;
const RIGHT = 96;
const GRID_WIDTH = 1920 - INSET - RIGHT;
const GAP = 36;

const posterWidth = (columns: number) => Math.floor((GRID_WIDTH - GAP * (columns - 1)) / columns);

/** Une ligne pleine de la grille, vue comme une rangée de l'accueil, défilée à `scrollX`. */
function lineOf(columns: number, scrollX = 0, cardCount = columns): RowHeadContext {
  return { cardCount, cardWidth: posterWidth(columns), gap: GAP, inset: INSET, viewportWidth: 1920, rightMargin: RIGHT, scrollX };
}

/** La grande carte d'une affiche de grille (`useCardGrowth`), à la taille réglée. */
function tileOf(columns: number, scale: number) {
  const width = posterWidth(columns);
  return trailerPreviewTileSize({ cardWidth: width, cardHeight: Math.round(width * 1.5), screenWidth: 1920, maxWidth: GRID_WIDTH, sizeScale: scale });
}

/** L'aperçu de la colonne `column` démarre : où la ligne défile, et où finit la grande carte à l'écran. */
function expandAt(columns: number, column: number, scale = 1) {
  const line = lineOf(columns);
  const tile = tileOf(columns, scale);
  const step = reduceRowHead(INITIAL_ROW_HEAD, { type: "expand", index: column, tileWidth: tile.width, at: 0 }, line);
  const scrollX = step.scrollTo ?? 0;
  const left = INSET + column * (line.cardWidth + GAP) - scrollX;
  return { step, scrollX, left, right: left + tile.width };
}

describe("une ligne de grille est un carrousel de l'accueil (trailerPreviewRowHead)", () => {
  it("au repos, une ligne pleine tient à l'écran, à chaque taille de cartes", () => {
    for (const size of CARD_SIZES) {
      const columns = CARD_SIZE_GRID_COLUMNS[size];
      const line = lineOf(columns);
      expect(INSET + columns * line.cardWidth + (columns - 1) * GAP).toBeLessThanOrEqual(1920 - RIGHT);
    }
  });

  it("la première colonne grandit sur place, la deuxième passe en tête, collée à la navigation", () => {
    expect(expandAt(6, 0).step.scrollTo).toBeNull();
    const second = expandAt(6, 1);
    expect(second.left).toBe(INSET);
  });

  it("en bout de ligne, la BUTÉE : la grande carte finit à la marge droite, jamais au-delà", () => {
    for (const size of CARD_SIZES) {
      const columns = CARD_SIZE_GRID_COLUMNS[size];
      const last = expandAt(columns, columns - 1, CARD_SIZE_SCALE[size]);
      expect(Math.abs(last.right - (1920 - RIGHT))).toBeLessThanOrEqual(1);
      // L'avant-dernière aussi tient entière à l'écran, sa voisine de droite après elle.
      const before = expandAt(columns, columns - 2, CARD_SIZE_SCALE[size]);
      expect(before.left).toBeGreaterThanOrEqual(INSET - 1);
      expect(before.right).toBeLessThanOrEqual(1920 - RIGHT + 1);
    }
  });

  it("la place se pose au bout avant de défiler : la piste peut l'atteindre", () => {
    const { step, scrollX } = expandAt(6, 5);
    expect(step.state.trailing).toBeGreaterThanOrEqual(scrollX);
    expect(step.motion).toBe("withPreview");
  });

  it("le focus parti de la ligne, elle revient à sa première colonne : la grille reste une grille", () => {
    const line = lineOf(6);
    const tile = tileOf(6, 1);
    let state = reduceRowHead(INITIAL_ROW_HEAD, { type: "focus", index: 4, at: 0 }, line).state;
    const expand = reduceRowHead(state, { type: "expand", index: 4, tileWidth: tile.width, at: 10 }, line);
    state = reduceRowHead(expand.state, { type: "blur", index: 4, at: 20 }, { ...line, scrollX: expand.scrollTo ?? 0 }).state;
    const leave = reduceRowHead(state, { type: "tick", at: 20 + 1_000 }, { ...line, scrollX: expand.scrollTo ?? 0 });
    expect(leave.scrollTo).toBe(0);
  });

  it("une dernière ligne incomplète garde le même comportement, sur ses seules affiches", () => {
    const line = lineOf(6, 0, 3);
    const tile = tileOf(6, 1);
    // Trois affiches : la grande carte de la troisième tient sans défiler au-delà de son besoin.
    const step = reduceRowHead(INITIAL_ROW_HEAD, { type: "expand", index: 2, tileWidth: tile.width, at: 0 }, line);
    const scrollX = step.scrollTo ?? 0;
    expect(INSET + 2 * (line.cardWidth + GAP) - scrollX + tile.width).toBeLessThanOrEqual(1920 - RIGHT + 1);
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
