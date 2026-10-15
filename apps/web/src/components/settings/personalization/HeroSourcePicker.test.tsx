import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { HERO_MODES, heroModesOffered } from "@tentacle-tv/shared";

/**
 * « Bandeau principal » (web, bureau) : chaque source est une carte qui dit ce
 * qu'elle montre, la retenue est cochée pour les lecteurs d'écran, Films et
 * Séries n'existent que face à un serveur qui les déclare, et « Un titre
 * choisi » déplie le choix du favori — ou dit qu'il n'y en a aucun.
 */

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const { HeroSourcePicker } = await import("./HeroSourcePicker");

function render(over: Partial<Parameters<typeof HeroSourcePicker>[0]> = {}): string {
  return renderToStaticMarkup(
    <HeroSourcePicker
      modes={HERO_MODES}
      value="recoMovies"
      onChange={() => {}}
      favorites={[{ Id: "a", Name: "Titre A" }]}
      fixedItemId={null}
      onFixedItemChange={() => {}}
      {...over}
    />,
  );
}

describe("HeroSourcePicker", () => {
  it("une carte par source, son nom et ce qu'elle montre, la retenue cochée", () => {
    const html = render();
    expect(html.match(/role="radio"/g)).toHaveLength(HERO_MODES.length);
    expect(html).toContain("homeSettings:heroRecoMovies");
    expect(html).toContain("homeSettings:heroRecoMoviesHint");
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1);
    // Une source « Pour vous » rappelle son repli.
    expect(html).toContain("heroFallbackNote");
  });

  it("face à un serveur sans la capacité : ni Films ni Séries", () => {
    const html = render({ modes: heroModesOffered(new Set()), value: "reco" });
    expect(html).not.toContain("homeSettings:heroRecoMovies");
    expect(html).not.toContain("homeSettings:heroRecoSeries");
    expect(html.match(/role="radio"/g)).toHaveLength(4);
  });

  it("« Un titre choisi » déplie les favoris ; sans favori, il le dit", () => {
    expect(render({ value: "fixed" })).toContain("Titre A");
    const none = render({ value: "fixed", favorites: [] });
    expect(none).toContain("heroFixedNoFavorites");
    expect(none).not.toContain("<select");
    expect(render({ value: "resume" })).not.toContain("<select");
  });
});
