import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { octavePaths } from "../octavePaths";

/**
 * Octave — « Gérer les profils » : une page DANS Octave, miroir de Réglages › Famille de Tentacle. Le corps EST la
 * page de Tentacle (jamais une copie), sous l'en-tête d'Octave, avec la portée « Compte » ; rien à y faire, on
 * retombe dans les Réglages d'Octave, jamais dans Tentacle.
 */

const h = vi.hoisted(() => ({ exitTo: [] as Array<string | undefined> }));

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@tentacle-tv/ui", () => ({ Shimmer: () => <span /> }));
vi.mock("../../../lazyPages", () => ({
  SettingsFamily: ({ exitTo }: { exitTo?: string }) => {
    h.exitTo.push(exitTo);
    return <section data-family-page />;
  },
}));

const { OctaveProfilesView } = await import("./OctaveProfilesView");

describe("Gérer les profils, dans Octave", () => {
  it("la page Famille de Tentacle elle-même, sous l'en-tête d'Octave et sa portée « Compte »", () => {
    const html = renderToStaticMarkup(<OctaveProfilesView />);
    expect(html).toContain("data-octave-profiles");
    expect(html).toContain("profiles.title");
    expect(html).toContain("data-family-page");
    expect(html).toContain("scope.account");
  });

  it("sans rien à gérer, retour aux Réglages d'Octave (on reste dans la musique)", () => {
    h.exitTo = [];
    renderToStaticMarkup(<OctaveProfilesView />);
    expect(h.exitTo).toEqual([octavePaths.settings]);
    expect(octavePaths.profiles.startsWith("/octave/")).toBe(true);
  });
});
