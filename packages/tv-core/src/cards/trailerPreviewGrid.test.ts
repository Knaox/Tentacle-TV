import { describe, expect, it } from "vitest";
import { CARD_SIZE_GRID_COLUMNS, CARD_SIZE_SCALE, CARD_SIZES } from "./cardSize";
import { GRID_PREVIEW_SETTLE_MS, gridFocusOutrun, gridPreviewSettleDelay, gridTrailerPreviewWarmWindow } from "./trailerPreviewGrid";
import { gridLineReprises, gridLineTurns, gridLineUnderRailFade, reduceGridLine } from "./trailerPreviewGridLine";
import { INITIAL_ROW_HEAD, type RowHeadContext } from "./trailerPreviewRowHead";
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
  const step = reduceGridLine(INITIAL_ROW_HEAD, { type: "expand", index: column, tileWidth: tile.width, at: 0 }, line);
  const scrollX = step.scrollTo ?? 0;
  const left = INSET + column * (line.cardWidth + GAP) - scrollX;
  return { step, scrollX, left, right: left + tile.width };
}

describe("une ligne de grille TOURNE (trailerPreviewGridLine, option C du 17/10)", () => {
  it("au repos, une ligne pleine tient à l'écran et peut tourner, à chaque taille de cartes", () => {
    for (const size of CARD_SIZES) {
      const columns = CARD_SIZE_GRID_COLUMNS[size];
      const line = lineOf(columns);
      expect(INSET + columns * line.cardWidth + (columns - 1) * GAP).toBeLessThanOrEqual(1920 - RIGHT);
      expect(gridLineTurns(line)).toBe(true);
    }
  });

  it("toute affiche sauf la dernière passe en tête, collée à la navigation", () => {
    for (const size of CARD_SIZES) {
      const columns = CARD_SIZE_GRID_COLUMNS[size];
      expect(expandAt(columns, 0, CARD_SIZE_SCALE[size]).step.scrollTo).toBeNull();
      for (let column = 1; column < columns - 1; column += 1) expect(expandAt(columns, column, CARD_SIZE_SCALE[size]).left).toBe(INSET);
    }
  });

  it("la dernière reste en BUTÉE : sa grande carte finit à la marge droite, jamais au-delà", () => {
    for (const size of CARD_SIZES) {
      const columns = CARD_SIZE_GRID_COLUMNS[size];
      const last = expandAt(columns, columns - 1, CARD_SIZE_SCALE[size]);
      expect(Math.abs(last.right - (1920 - RIGHT))).toBeLessThanOrEqual(1);
    }
  });

  it("la place au bout est posée avant de défiler, et les reprises la remplissent : jamais de vide", () => {
    for (let column = 1; column < 5; column += 1) {
      const { step, scrollX } = expandAt(6, column);
      expect(step.motion).toBe("withPreview");
      // La piste, ses cartes au repos, atteint le défilement voulu.
      expect(INSET + 6 * posterWidth(6) + 5 * GAP + RIGHT + step.state.trailing).toBeGreaterThanOrEqual(scrollX + 1920);
      const reprises = gridLineReprises(step.state.trailing, 6, posterWidth(6) + GAP);
      expect(reprises.length * (posterWidth(6) + GAP)).toBeGreaterThanOrEqual(step.state.trailing);
      // Le début de la MÊME ligne, dans l'ordre.
      expect(reprises.slice(0, column)).toEqual(Array.from({ length: Math.min(column, reprises.length) }, (_, i) => i));
    }
  });

  it("le repli de la tête quand le focus passe à droite ne fait pas reculer la ligne", () => {
    const tile = tileOf(6, 1);
    const expand = expandAt(6, 3);
    const line = lineOf(6, expand.scrollX);
    const moved = reduceGridLine(expand.step.state, { type: "focus", index: 4, at: 20 }, line);
    const collapse = reduceGridLine(moved.state, { type: "collapse", index: 3, tileWidth: tile.width, at: 30 }, line);
    expect(collapse.scrollTo).toBeNull();
  });

  it("le focus parti de la ligne, elle revient à sa première colonne, puis la place s'en va", () => {
    const expand = expandAt(6, 4);
    const line = lineOf(6, expand.scrollX);
    const blurred = reduceGridLine(expand.step.state, { type: "blur", index: 4, at: 20 }, line).state;
    const leave = reduceGridLine(blurred, { type: "tick", at: 1_000 }, line);
    expect(leave.scrollTo).toBe(0);
    const released = reduceGridLine(leave.state, { type: "tick", at: 10_000 }, lineOf(6, 0));
    expect(released.state.trailing).toBe(0);
  });

  it("une dernière ligne incomplète ne tourne pas : sa grande carte y tient, rien ne défile", () => {
    const line = lineOf(6, 0, 3);
    expect(gridLineTurns(line)).toBe(false);
    const step = reduceGridLine(INITIAL_ROW_HEAD, { type: "expand", index: 1, tileWidth: tileOf(6, 1).width, at: 0 }, line);
    expect(step.scrollTo).toBeNull();
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

describe("gridLineUnderRailFade — une affiche sortie sous la navigation s'atténue", () => {
  it("pleine en tête, atténuée une colonne plus à gauche, jamais transparente", () => {
    const w = posterWidth(6);
    const { centers, opacities } = gridLineUnderRailFade({ inset: INSET, cardWidth: w });
    const head = INSET + w / 2;
    expect(head).toBeGreaterThanOrEqual(centers[1]);
    expect(head - (w + GAP)).toBeLessThanOrEqual(centers[0]);
    expect(opacities[0]).toBeGreaterThan(0.01);
    expect(opacities[1]).toBe(1);
  });
});
