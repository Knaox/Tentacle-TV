import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { HeroScrims } from "./HeroScrims";

/**
 * Le balisage attendu est celui d'AVANT la factorisation, copié depuis les
 * trois composants tel qu'il était. C'est tout l'objet de ce banc : prouver
 * qu'un composant partagé rend exactement ce que rendaient trois copies, à la
 * classe et à l'ordre près. Sans cela, « c'est le même » reste une intention.
 *
 * L'accueil et la fiche ne changent donc PAS. La bibliothèque, elle, change —
 * délibérément, et c'est le dernier cas ci-dessous qui dit en quoi.
 */

const DIAGONAL = (j: string) =>
  `<div class="absolute inset-0" style="background:var(--${j}-scrim-diagonal)"></div>`;
const MARKER = (j: string) =>
  `<div class="pointer-events-none absolute inset-0" style="background:var(--${j}-brand-wash)" aria-hidden="true"></div>`;
const BOTTOM = (j: string, h: string) =>
  `<div class="absolute inset-x-0 bottom-0 ${h}" style="background:var(--${j}-scrim-bottom)"></div>`;
const SEAM = (j: string, h: string) =>
  `<div class="pointer-events-none absolute inset-x-0 bottom-0 ${h}" style="background:var(--${j}-page-fade)" aria-hidden="true"></div>`;
const TOP = (j: string, h: string) =>
  `<div class="absolute inset-x-0 top-0 ${h}" style="background:var(--${j}-scrim-top)"></div>`;
const GRAIN = `<div class="noise-texture absolute inset-0 opacity-[0.06]" aria-hidden="true"></div>`;

describe("HeroScrims", () => {
  it("rend pour l'accueil exactement ce que rendait HeroBackdrop", () => {
    expect(renderToStaticMarkup(<HeroScrims bottom="h-[62%]" />)).toBe(
      DIAGONAL("hero") + MARKER("hero") + BOTTOM("hero", "h-[62%]") + TOP("hero", "h-40") + GRAIN,
    );
  });

  it("rend pour la fiche exactement ce que rendait DetailHero", () => {
    expect(
      renderToStaticMarkup(
        <HeroScrims tokenSet="detail" bottom="h-[74%]" top="h-32" seam="h-[46%]" grain={false} />,
      ),
    ).toBe(
      DIAGONAL("detail") + MARKER("detail") + BOTTOM("detail", "h-[74%]")
      + SEAM("detail", "h-[46%]") + TOP("detail", "h-32"),
    );
  });

  it("rend pour la bibliothèque la pile de l'accueil, et non plus la sienne", () => {
    // Ce qu'elle rendait : `h-[76%]` au lieu de `h-[62%]`, plus un raccord de
    // page. Le premier est une rampe vingt pour cent plus raide, dimensionnée
    // pour un débord de 200 px que le téléviseur annule ; le second est une
    // sixième couche quantifiée dans la zone la plus sombre de l'image.
    const old = DIAGONAL("hero") + MARKER("hero") + BOTTOM("hero", "h-[76%]")
      + SEAM("hero", "h-[44%]") + TOP("hero", "h-40") + GRAIN;
    const fresh = renderToStaticMarkup(<HeroScrims bottom="h-[62%]" />);
    expect(fresh).not.toBe(old);
    expect(fresh).toBe(renderToStaticMarkup(<HeroScrims bottom="h-[62%]" />));
    expect(fresh).not.toContain("page-fade");
  });

  it("n'émet aucun calque de raccord quand il n'y en a pas", () => {
    expect(renderToStaticMarkup(<HeroScrims bottom="h-[62%]" />)).not.toContain("page-fade");
  });

  it("n'émet aucun grain quand il est refusé", () => {
    expect(renderToStaticMarkup(<HeroScrims bottom="h-[50%]" grain={false} />))
      .not.toContain("noise-texture");
  });
});
