import { describe, expect, it, vi } from "vitest";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * Le redesign de l'affiche tient à des ABSENCES autant qu'à des présences :
 * plus d'anneau SVG relancé chaque seconde, plus de backdrop-filter, plus de
 * surface d'application sous du texte blanc. Un rendu statique suffit à les
 * prouver — on ne teste pas l'animation, on teste la matière (même approche
 * que HeroScrims.test.tsx).
 *
 * i18n et framer-motion sont REMPLACÉS : chargés en vrai sous vitest, ils
 * tirent une seconde copie de React et le rendu s'effondre (« Invalid hook
 * call »). `t()` rend la clé — c'est elle qui est vérifiée, le texte
 * appartient aux locales — et `motion.<tag>` rend la balise nue, les props
 * d'animation en moins.
 */

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("framer-motion", () => ({
  useReducedMotion: () => false,
  motion: new Proxy(
    {},
    {
      get: (_target, tag: string) =>
        function MotionStub(props: Record<string, unknown>) {
          const { initial: _i, animate: _a, exit: _e, transition: _t, ...rest } = props;
          return createElement(tag, rest);
        },
    },
  ),
}));

const { NextEpisodeFullscreen } = await import("./NextEpisodeFullscreen");

const render = (props: Partial<ComponentProps<typeof NextEpisodeFullscreen>> = {}) =>
  renderToStaticMarkup(
    <NextEpisodeFullscreen
      countdown={8}
      totalSeconds={10}
      episodeTitle="S01E02 — L'épisode d'après"
      onPlayNow={() => undefined}
      onDismiss={() => undefined}
      {...props}
    />,
  );

describe("NextEpisodeFullscreen — la matière de la pilule", () => {
  it("plus aucun backdrop-filter, nulle part", () => {
    const html = render({
      seriesBackdropUrl: "http://img/backdrop.jpg",
      episodeThumbUrl: "http://img/thumb.jpg",
    });
    expect(html).not.toContain("backdrop-filter");
    expect(html).not.toContain("backdrop-blur");
  });

  it("le décompte vit dans le geste : balayage sous le libellé décompté, plus d'anneau", () => {
    const html = render();
    expect(html).toContain("playNowIn");
    // Le voile Sweep : pleine surface, origine gauche, caché sous animations
    // réduites (le libellé décompte alors seul).
    expect(html).toContain("origin-left");
    expect(html).toContain("motion-reduce:hidden");
    expect(html).not.toContain("stroke-dasharray");
  });

  it("le balayage reprend où le minuteur en était — jamais de zéro menteur", () => {
    // 8 s restantes sur 10 : le voile part à 20 % (escalade carte → affiche).
    expect(render()).toContain("scaleX(0.2)");
  });

  it("sans décompte, une proposition : ni balayage ni chiffre", () => {
    const html = render({ countdown: null });
    expect(html).not.toContain("playNowIn");
    expect(html).toContain("playNow");
    expect(html).not.toContain("origin-left");
  });

  it("refuser dit où l'on va : la croix et le bouton secondaire portent backToDetails", () => {
    const occurrences = render().match(/backToDetails/g)?.length ?? 0;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });

  it("sans bannière, un repli sombre en dur — jamais une surface de l'application", () => {
    const html = render();
    expect(html).toContain("linear-gradient(135deg, #2b2436");
    expect(html).not.toContain("var(--surface-1)");
  });
});
