import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// Le halo passe par framer-motion, qui embarque sa propre copie de React en
// test : on le remplace par un témoin qui dit quelle image il floute.
vi.mock("../../components/hero/AmbilightLayer", () => ({
  AmbilightLayer: ({ url }: { url: string }) => <i data-halo={url} />,
}));
import { HeroBanner } from "./HeroBanner";
import type { HeroSlide } from "./heroSlides";

const slide = (id: string): HeroSlide => ({
  id,
  backdropUri: `${id}-large`,
  haloUri: `${id}-halo`,
  posterUri: `${id}-poster`,
  haloPosterUri: `${id}-poster-halo`,
  render: (active) => <p data-slide={id}>{active ? "actif" : "repos"}</p>,
});

describe("HeroBanner", () => {
  it("rend une page par diapositive, la première active, et un point par diapositive", () => {
    const html = renderToStaticMarkup(<HeroBanner slides={[slide("a"), slide("b"), slide("c")]} />);
    expect(html).toContain('data-slide="a">actif');
    expect(html).toContain('data-slide="b">repos');
    // Le point actif fait 22, les deux autres 6.
    expect(html.match(/w-\[22px\]/g)).toHaveLength(1);
    expect(html.match(/w-1\.5 rounded-sm/g)).toHaveLength(2);
    // Un calque d'image par diapositive, la première seule visible et zoomée.
    expect(html.match(/mirror-hero-zoom/g)).toHaveLength(1);
    // Le halo floute l'image ACTIVE (visuel large : viewport serveur paysage).
    expect(html).toContain('data-halo="a-halo"');
  });

  it("n'affiche aucun point pour une diapositive seule", () => {
    const html = renderToStaticMarkup(<HeroBanner slides={[slide("a")]} />);
    expect(html).not.toContain("w-[22px]");
  });
});
