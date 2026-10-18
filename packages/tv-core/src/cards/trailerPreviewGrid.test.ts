import { describe, expect, it } from "vitest";
import { GRID_PREVIEW_SETTLE_MS, GRID_SLOW_SPEED, gridFocusOutrun, gridPreviewSettleDelay, gridScrollSpeed, gridTrailerPreviewWarmWindow, gridVisibleLines } from "./trailerPreviewGrid";

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

describe("gridScrollSpeed — la page qui ralentit au bout d'un défilement", () => {
  it("la vitesse entre deux relevés, en points par seconde", () => {
    expect(gridScrollSpeed({ y: 0, at: 0 }, { y: 100, at: 50 })).toBe(2_000);
    expect(gridScrollSpeed({ y: 500, at: 0 }, { y: 490, at: 50 })).toBe(200);
  });

  it("pas mesurable : sans relevé d'avant, ou deux relevés trop rapprochés", () => {
    expect(gridScrollSpeed(null, { y: 10, at: 10 })).toBeNull();
    expect(gridScrollSpeed({ y: 0, at: 0 }, { y: 10, at: 3 })).toBeNull();
  });

  it("le seuil du ralenti : la fin de course d'une page (quelques points par image) passe dessous", () => {
    expect(gridScrollSpeed({ y: 0, at: 0 }, { y: 5, at: 16 })!).toBeLessThan(GRID_SLOW_SPEED);
    expect(gridScrollSpeed({ y: 0, at: 0 }, { y: 80, at: 16 })!).toBeGreaterThan(GRID_SLOW_SPEED);
  });
});

describe("gridVisibleLines — les lignes à l'écran", () => {
  it("la page en haut : la première ligne et celle qui dépasse en bas", () => {
    expect(gridVisibleLines({ scrollY: 0, firstLineTop: 250, stride: 574, viewport: 648 })).toEqual({ first: 0, last: 0 });
  });

  it("défilée : les lignes coupées par les bords comptent", () => {
    expect(gridVisibleLines({ scrollY: 250 + 574 * 70 - 32, firstLineTop: 250, stride: 574, viewport: 648 })).toEqual({ first: 69, last: 71 });
  });
});
