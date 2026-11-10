/**
 * Défaut H du relevé : une image DÉJÀ VUE manquait pendant au moins une image
 * à chaque remontage de sa carte. `pageReturnFlicker.test.tsx` vérifie que le
 * squelette ne revient pas ; il ne voyait pas que l'`<img>` elle-même n'était
 * pas rendue — `useNearViewport` démarre à faux et n'ouvre qu'après le premier
 * passage de l'observateur : la carte était un rectangle VIDE le temps d'une
 * image, d'où le clignotement au retour sur une page.
 *
 * Ces cas regardent le PREMIER rendu (ce que React pose avant tout effet).
 */
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";
import { CardImage } from "./CardImage";
import { CardTrickplayImage } from "./CardTrickplayImage";
import { FadeImage } from "../FadeImage";
import type { ResumeFrame } from "../../hooks/useResumeFrame";
import { markImageSeen, resetSeenImagesForTests } from "../../lib/seenImages";

const frame = (url: string): ResumeFrame =>
  ({ url, col: 2, row: 3, info: { Width: 320, Height: 180, TileWidth: 10, TileHeight: 10 } }) as ResumeFrame;

/** L'opacité en ligne de la première balise qui correspond. */
function opacityOf(markup: string, tag: RegExp): string | null {
  const element = tag.exec(markup)?.[0] ?? "";
  return /opacity:([\d.]+)/.exec(element)?.[1] ?? null;
}

beforeEach(() => resetSeenImagesForTests());

describe("premier rendu d'une affiche (CardImage)", () => {
  it("déjà vue : l'image est là d'emblée, pleine, sans squelette", () => {
    markImageSeen("/affiche.jpg");
    const markup = renderToStaticMarkup(<CardImage src="/affiche.jpg" alt="Matrix" />);
    expect(markup).toContain('src="/affiche.jpg"');
    expect(opacityOf(markup, /<img[^>]*>/)).toBe("1");
    expect(markup).not.toContain("skeleton-shimmer");
  });

  it("jamais vue : rien n'est demandé avant d'approcher de l'écran", () => {
    const markup = renderToStaticMarkup(<CardImage src="/neuve.jpg" alt="" />);
    expect(markup).not.toContain("<img");
    expect(markup).toContain("skeleton-shimmer");
  });
});

describe("premier rendu d'une vignette de reprise (CardTrickplayImage)", () => {
  it("planche déjà vue : la vignette est là d'emblée, pleine", () => {
    markImageSeen("/planche-0.jpg");
    const markup = renderToStaticMarkup(<CardTrickplayImage frame={frame("/planche-0.jpg")} alt="" fallback={null} />);
    expect(markup).toContain('src="/planche-0.jpg"');
    expect(opacityOf(markup, /<div role="img"[^>]*>/)).toBe("1");
    expect(markup).not.toContain("skeleton-shimmer");
  });

  it("planche jamais vue : squelette, aucune requête", () => {
    const markup = renderToStaticMarkup(<CardTrickplayImage frame={frame("/planche-1.jpg")} alt="" fallback={null} />);
    expect(markup).not.toContain("<img");
    expect(markup).toContain("skeleton-shimmer");
  });
});

describe("premier rendu d'une image de liste (FadeImage)", () => {
  it("déjà vue : pleine d'emblée, le fondu ne se rejoue pas", () => {
    markImageSeen("/episode.jpg");
    expect(opacityOf(renderToStaticMarkup(<FadeImage src="/episode.jpg" alt="" />), /<img[^>]*>/)).toBe("1");
  });

  it("jamais vue : elle paraît une fois, en fondu", () => {
    expect(opacityOf(renderToStaticMarkup(<FadeImage src="/neuf.jpg" alt="" />), /<img[^>]*>/)).toBe("0");
  });
});
