import { describe, expect, it } from "vitest";
import frTrailerHelp from "../i18n/locales/fr/trailerHelp";
import enTrailerHelp from "../i18n/locales/en/trailerHelp";
import {
  JELLYFIN_EXTRAS_DOC_URL,
  TRAILER_GUIDE_STEPS,
  resolveGuideLink,
  trailerGuideHref,
  trailerGuideKeys,
  type TrailerGuideLink,
  type TrailerGuideLinkContext,
} from "./trailerGuide";

const ADMIN_IN_APP: TrailerGuideLinkContext = { isAdmin: true, jellyfinUrl: "https://jf.example.org/", adminOrigin: "app" };
const LIBRARIES: TrailerGuideLink = { kind: "jellyfin", page: "libraries", labelKey: "linkJellyfinLibraries" };
const OVERVIEW: TrailerGuideLink = { kind: "admin", page: "overview", labelKey: "linkAdminOverview" };
const DOCS: TrailerGuideLink = { kind: "docs", url: JELLYFIN_EXTRAS_DOC_URL, labelKey: "linkJellyfinDocs" };

describe("le modèle du guide « Bandes-annonces »", () => {
  it("chaque clé qu'il référence existe en français et en anglais", () => {
    const missing = trailerGuideKeys().filter((key) => !(key in frTrailerHelp) || !(key in enTrailerHelp));
    expect(missing).toEqual([]);
  });

  it("les deux premières étapes sont obligatoires, TheMovieDb d'abord", () => {
    expect(TRAILER_GUIDE_STEPS.slice(0, 2).map((step) => [step.id, step.optional])).toEqual([
      ["tmdb", false],
      ["refresh", false],
    ]);
  });

  it("l'adresse du guide et de sa partie administrateur", () => {
    expect(trailerGuideHref()).toBe("/help/trailers");
    expect(trailerGuideHref("admin")).toBe("/help/trailers#admin");
  });
});

describe("resolveGuideLink", () => {
  it("la documentation s'ouvre pour tout le monde, hors de l'application", () => {
    const anyone: TrailerGuideLinkContext = { isAdmin: false, jellyfinUrl: null, adminOrigin: null };
    expect(resolveGuideLink(DOCS, anyone)).toEqual({ href: JELLYFIN_EXTRAS_DOC_URL, external: true });
  });

  it("le tableau de bord de Jellyfin : administrateur seulement, adresse connue, sans double barre", () => {
    expect(resolveGuideLink(LIBRARIES, ADMIN_IN_APP)).toEqual({
      href: "https://jf.example.org/web/#/dashboard/libraries",
      external: true,
    });
    expect(resolveGuideLink(LIBRARIES, { ...ADMIN_IN_APP, isAdmin: false })).toBeNull();
    expect(resolveGuideLink(LIBRARIES, { ...ADMIN_IN_APP, jellyfinUrl: null })).toBeNull();
  });

  it("l'administration de Tentacle : route interne dans l'app, navigateur depuis le mobile", () => {
    expect(resolveGuideLink(OVERVIEW, ADMIN_IN_APP)).toEqual({ href: "/admin", external: false });
    expect(resolveGuideLink(OVERVIEW, { ...ADMIN_IN_APP, adminOrigin: "https://tentacle.example.org/" })).toEqual({
      href: "https://tentacle.example.org/admin",
      external: true,
    });
    expect(resolveGuideLink(OVERVIEW, { ...ADMIN_IN_APP, isAdmin: false })).toBeNull();
    expect(resolveGuideLink(OVERVIEW, { ...ADMIN_IN_APP, adminOrigin: null })).toBeNull();
  });
});
