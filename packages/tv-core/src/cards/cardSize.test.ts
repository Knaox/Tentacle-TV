import { describe, expect, it } from "vitest";
import {
  CARD_SIZES,
  cardArtworkFor,
  cardMetricsOf,
  DEFAULT_CARD_SIZE,
  parseCardSize,
  type CardMetrics,
} from "./cardSize";

/** Les gabarits de la scène (`TV_STAGE.card`), recopiés : ce test ne dépend pas du thème. */
const BASE = {
  landscape: { width: 380, height: 214, radius: 22 },
  poster: { width: 240, height: 360, radius: 20 },
} as const;

/** La piste d'une rangée sur le canevas 1920 : après la navigation repliée, jusqu'à la marge de droite. */
const TRACK = 1920 - 176 - 96;
const GAP = 36;
/** Le canevas en hauteur, et ce qu'une rangée d'affiches prend autour de ses cartes (titre, légende, pied). */
const SCREEN_HEIGHT = 1080;
const ROW_CHROME = 44 + 14 + 70 + 40;
const FOCUS_SCALE = 1.08;
const SAFE_Y = 54;
/** La largeur d'une grille d'affiches, et son espacement (`PosterGrid`). */
const GRID_WIDTH = 1920 - 176 - 96;

const cardsPerRow = (width: number) => (TRACK + GAP) / (width + GAP);
const gridPosterWidth = (columns: number) => Math.floor((GRID_WIDTH - GAP * (columns - 1)) / columns);

function expectFormatKept(metrics: CardMetrics) {
  expect(Math.abs(metrics.landscape.height - (metrics.landscape.width * 9) / 16)).toBeLessThanOrEqual(1);
  expect(Math.abs(metrics.poster.height - metrics.poster.width * 1.5)).toBeLessThanOrEqual(1);
}

describe("la taille lue du stockage", () => {
  it("rend une taille connue telle quelle", () => {
    for (const size of CARD_SIZES) expect(parseCardSize(size)).toBe(size);
  });

  it("rend la taille par défaut, Grande, pour rien, une valeur inconnue ou d'une autre casse", () => {
    expect(DEFAULT_CARD_SIZE).toBe("large");
    expect(parseCardSize(null)).toBe("large");
    expect(parseCardSize(undefined)).toBe("large");
    expect(parseCardSize("")).toBe("large");
    expect(parseCardSize("huge")).toBe("large");
    expect(parseCardSize("Large")).toBe("large");
  });

  it("une taille déjà choisie reste la sienne, Normale comprise", () => {
    expect(parseCardSize("normal")).toBe("normal");
    expect(parseCardSize("small")).toBe("small");
  });
});

describe("taille normale", () => {
  const metrics = cardMetricsOf("normal", BASE);

  it("garde les gabarits d'avant le réglage, à l'identique", () => {
    expect(metrics.landscape).toBe(BASE.landscape);
    expect(metrics.poster).toBe(BASE.poster);
    expect(metrics.scale).toBe(1);
    expect(metrics.gridColumns).toBe(6);
  });

  it("garde les images d'avant (aucune requête de plus)", () => {
    const artwork = { landscapeWidth: 640, posterHeight: 480 };
    expect(cardArtworkFor(artwork, "normal")).toBe(artwork);
  });
});

describe("petite taille", () => {
  const metrics = cardMetricsOf("small", BASE);

  it("est plus petite que la normale, mais pas trop (au moins 80 %)", () => {
    expect(metrics.landscape.width).toBeLessThan(BASE.landscape.width);
    expect(metrics.landscape.width).toBeGreaterThanOrEqual(BASE.landscape.width * 0.8);
    expect(metrics.poster.width).toBeLessThan(BASE.poster.width);
    expect(metrics.poster.width).toBeGreaterThanOrEqual(BASE.poster.width * 0.8);
  });

  it("garde les formats 16:9 et 2:3", () => expectFormatKept(metrics));

  it("montre une vignette de plus par rangée, environ", () => {
    expect(cardsPerRow(metrics.landscape.width)).toBeGreaterThan(cardsPerRow(BASE.landscape.width) + 0.6);
    expect(cardsPerRow(metrics.landscape.width)).toBeLessThan(5.5);
  });

  it("ajoute une colonne aux grilles, dont l'affiche suit la petite affiche des rangées", () => {
    expect(metrics.gridColumns).toBe(7);
    expect(Math.abs(gridPosterWidth(metrics.gridColumns) - metrics.poster.width)).toBeLessThanOrEqual(12);
  });

  it("garde les images de la taille normale (déjà en cache)", () => {
    const artwork = { landscapeWidth: 412, posterHeight: 400 };
    expect(cardArtworkFor(artwork, "small")).toBe(artwork);
  });
});

describe("grande taille (Netflix)", () => {
  const metrics = cardMetricsOf("large", BASE);

  it("agrandit nettement les cartes (au moins 25 %)", () => {
    expect(metrics.landscape.width).toBeGreaterThanOrEqual(BASE.landscape.width * 1.25);
    expect(metrics.poster.width).toBeGreaterThanOrEqual(BASE.poster.width * 1.25);
  });

  it("garde les formats 16:9 et 2:3", () => expectFormatKept(metrics));

  it("montre un peu plus de trois vignettes par rangée, comme Netflix", () => {
    const shown = cardsPerRow(metrics.landscape.width);
    expect(shown).toBeGreaterThanOrEqual(3);
    expect(shown).toBeLessThan(3.8);
  });

  it("tient une rangée d'affiches focalisée entière dans l'écran, marges de sécurité comprises", () => {
    expect(metrics.poster.height * FOCUS_SCALE + ROW_CHROME).toBeLessThan(SCREEN_HEIGHT - 2 * SAFE_Y);
  });

  it("retire une colonne aux grilles", () => {
    expect(metrics.gridColumns).toBe(5);
    expect(gridPosterWidth(metrics.gridColumns)).toBeGreaterThan(gridPosterWidth(6));
  });

  it("demande des images agrandies d'autant : la grande carte reste nette", () => {
    const tvos = cardArtworkFor({ landscapeWidth: 640, posterHeight: 480 }, "large");
    expect(tvos).toEqual({ landscapeWidth: 832, posterHeight: 624 });
    // Android TV (un pixel par point) : la grande vignette agrandie par le focus.
    const android = cardArtworkFor({ landscapeWidth: 412, posterHeight: 400 }, "large");
    expect(android.landscapeWidth).toBeGreaterThanOrEqual(Math.floor(metrics.landscape.width * FOCUS_SCALE));
    expect(android.posterHeight).toBeGreaterThanOrEqual(Math.floor(metrics.poster.height * FOCUS_SCALE) - 8);
  });
});

describe("les trois tailles ensemble", () => {
  it("vont du plus petit au plus grand, dans l'ordre du réglage", () => {
    const widths = CARD_SIZES.map((size) => cardMetricsOf(size, BASE).landscape.width);
    expect([...widths].sort((a, b) => a - b)).toEqual(widths);
    const columns = CARD_SIZES.map((size) => cardMetricsOf(size, BASE).gridColumns);
    expect([...columns].sort((a, b) => b - a)).toEqual(columns);
  });
});
