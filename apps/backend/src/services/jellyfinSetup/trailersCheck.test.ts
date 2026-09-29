/**
 * « Bandes-annonces » : la cause cherchée dans l'ordre — TMDB écarté, puis
 * des métadonnées jamais complétées — et ce qui la rattrape (Jellyseerr par
 * Vigie). Formes relevées sur 10.11.8 et 12.1.0 (2026-09-29).
 */

import { describe, expect, it } from "vitest";
import type { SetupCheck } from "../jellyfinCompat/setupContract";
import { evaluateSetup } from "./setupChecks";
import type { SetupSnapshot } from "./setupSnapshot";
import { hasTmdbId, hasTrailer } from "./trailerCoverage";

const films = (options: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => ({
  Name: "Films", CollectionType: "movies", ItemId: "films", RefreshStatus: "Idle", LibraryOptions: { TypeOptions: [], ...options }, ...extra,
});

function snapshot(patch: Partial<SetupSnapshot> = {}): SetupSnapshot {
  return {
    version: "12.1.0",
    restartPending: false,
    libraries: [films()],
    plugins: [{ Name: "TMDb", Status: "Active", Id: "b8715ed16c4745289ad3f72deb539cd4" }],
    config: { PreferredMetadataLanguage: "fr", MetadataCountryCode: "FR" },
    encoding: { HardwareAccelerationType: "none" },
    tasks: [],
    missingTmdb: 1,
    trailers: { titles: 4, withTmdb: 3, withTrailer: 1, sampled: false },
    ...patch,
  };
}

const trailers = (checks: SetupCheck[]) => checks.find((check) => check.id === "trailers") as SetupCheck;
const GAP = { label: { fr: "Bandes-annonces locales", en: "Local trailers" }, note: { fr: "vides", en: "empty" } };

describe("bandes-annonces", () => {
  it("une sur trois des titres connus de TMDB : à faire, et les métadonnées manquantes se cherchent d'un clic", () => {
    const check = trailers(evaluateSetup(snapshot()));
    expect(check).toMatchObject({ state: "todo", action: "refreshMissingMetadata", trailers: { withTrailer: 1, withTmdb: 3, jellyseerr: false } });
  });

  it("TMDB écarté d'une bibliothèque : c'est la cause, et son remède est dans Jellyfin (pas de geste)", () => {
    const libraries = [films({ TypeOptions: [{ Type: "Movie", MetadataFetchers: ["The Open Movie Database"] }] })];
    const check = trailers(evaluateSetup(snapshot({ libraries })));
    expect(check).toMatchObject({ state: "todo", action: null, dashboardPath: "/web/#/dashboard/libraries" });
    expect(check.libraries).toEqual([{ id: "films", name: "Films", enabled: false }]);
  });

  it("greffon TMDb coupé : à faire, la page des greffons", () => {
    const plugins = [{ Name: "TMDb", Status: "Disabled", Id: "b8715ed16c4745289ad3f72deb539cd4" }];
    expect(trailers(evaluateSetup(snapshot({ plugins })))).toMatchObject({ state: "todo", action: null, dashboardPath: "/web/#/dashboard/plugins" });
  });

  it("la moitié au moins : fait", () => {
    const check = trailers(evaluateSetup(snapshot({ trailers: { titles: 4, withTmdb: 3, withTrailer: 2, sampled: false } })));
    expect(check).toMatchObject({ state: "done", action: null });
  });

  it("Jellyseerr branché par Vigie rattrape une couverture faible", () => {
    const check = trailers(evaluateSetup(snapshot(), { jellyseerr: true, compatGaps: [] }));
    expect(check).toMatchObject({ state: "done", trailers: { jellyseerr: true } });
  });

  it("une actualisation en cours : pas de second geste", () => {
    const check = trailers(evaluateSetup(snapshot({ libraries: [films({}, { RefreshStatus: "Active" })] })));
    expect(check).toMatchObject({ state: "todo", action: null, trailers: { refreshing: true } });
  });

  it("ce que la compatibilité dit des bonus voyage avec le diagnostic", () => {
    const check = trailers(evaluateSetup(snapshot(), { jellyseerr: false, compatGaps: [GAP] }));
    expect(check.trailers?.compatGaps).toEqual([GAP]);
  });

  it("aucun titre, ou rien de compté : inconnu", () => {
    expect(trailers(evaluateSetup(snapshot({ trailers: null }))).state).toBe("unknown");
    expect(trailers(evaluateSetup(snapshot({ trailers: { titles: 0, withTmdb: 0, withTrailer: 0, sampled: false } }))).state).toBe("unknown");
  });
});

describe("compte d'un titre", () => {
  it("une bande-annonce distante OU locale compte", () => {
    expect(hasTrailer({ RemoteTrailers: [{ Url: "https://www.youtube.com/watch?v=x" }] })).toBe(true);
    expect(hasTrailer({ RemoteTrailers: [], LocalTrailerCount: 1 })).toBe(true);
    expect(hasTrailer({ RemoteTrailers: [], LocalTrailerCount: 0 })).toBe(false);
    expect(hasTrailer({})).toBe(false);
  });

  it("un identifiant TMDB, quelle que soit la casse du fournisseur", () => {
    expect(hasTmdbId({ ProviderIds: { Tmdb: "27205", Imdb: "tt1375666" } })).toBe(true);
    expect(hasTmdbId({ ProviderIds: { tmdb: "27205" } })).toBe(true);
    expect(hasTmdbId({ ProviderIds: { Imdb: "tt1375666" } })).toBe(false);
    expect(hasTmdbId({ ProviderIds: { Tmdb: "" } })).toBe(false);
  });
});
