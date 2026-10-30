import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * La transition douce DANS le lecteur (bureau, web large) : le même réglage que la page Réglages d'Octave —
 * allumée à 5 s d'office, une réglette à crans (coupée, puis 2 → 12 s), le dessin du fondu et « couper ».
 */

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string, o?: { count?: number }) => (o?.count !== undefined ? `${key}:${o.count}` : key) }) }));

const { CrossfadeDial } = await import("./CrossfadeDial");
const { getCrossfadeMs, setCrossfadeMs } = await import("../../../engine/crossfadeSetting");

describe("la transition douce dans le lecteur", () => {
  it("allumée à 5 s d'office : la valeur, le dessin, la réglette au 4e cran", () => {
    expect(getCrossfadeMs()).toBe(5_000);
    const html = renderToStaticMarkup(<CrossfadeDial />);
    expect(html).toContain("crossfade.seconds:5");
    expect(html).toContain("data-crossfade-graph");
    expect(html).toContain('aria-valuetext="crossfade.seconds:5"');
    expect(html).toContain('max="11"');
    expect(html).toContain('value="4"');
    expect(html).toContain("crossfade.turnOff");
  });

  it("coupée : la réglette tout à gauche, « activer » proposé", () => {
    setCrossfadeMs(0);
    const html = renderToStaticMarkup(<CrossfadeDial />);
    expect(html).toContain('value="0"');
    expect(html).toContain("crossfade.turnOn");
    expect(html).toContain("crossfade.controlOff");
    setCrossfadeMs(5_000);
  });
});
