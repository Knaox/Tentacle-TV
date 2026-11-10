import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveScopeOf, seriesPrefStateOf } from "./trackPrefScope";
import { localTrackPrefFor, mirrorSeriesPref, seriesPrefFor } from "../offline/seriesTrackPref";
import { rememberItemTracks } from "../offline/localItemTracks";
import { cacheLibraryPrefs } from "../offline/localTrackPrefs";

/**
 * Défaut F du relevé : « Appliquer à cette série » cochée, la série doit
 * l'emporter sur le choix propre à l'épisode et sur la saison — en ligne (ce
 * que la résolution demande au serveur) comme en lecture locale (le cache de
 * l'appareil).
 */

const episode = { Id: "ep7", Type: "Episode", SeriesId: "serie", ParentId: "saison2" } as const;
const movie = { Id: "film", Type: "Movie", ParentId: "dossier" } as const;

describe("en ligne : ce que la résolution demande au serveur", () => {
  it("sans série cochée, l'ordre d'avant : le contenu, la saison, la série, les ancêtres", () => {
    expect(resolveScopeOf(episode, ["biblio"], "none")).toEqual({
      libraryId: "saison2", libraryIds: ["saison2", "serie", "biblio"], itemId: "ep7",
    });
  });

  it("série cochée : elle seule, sans le contenu — elle bat l'épisode et la saison", () => {
    expect(resolveScopeOf(episode, ["biblio"], "set")).toEqual({ libraryId: "serie", libraryIds: ["serie"] });
  });

  it("un film ne change pas", () => {
    expect(resolveScopeOf(movie, ["biblio"], "set")).toEqual({ libraryId: "dossier", libraryIds: ["dossier", "biblio"], itemId: "film" });
  });

  it("sait attendre la préférence de série, jamais indéfiniment", () => {
    expect(seriesPrefStateOf("serie", { data: undefined, isError: false, isFetching: true })).toBe("pending");
    expect(seriesPrefStateOf("serie", { data: { audioLang: "jpn" }, isError: false, isFetching: false })).toBe("set");
    expect(seriesPrefStateOf("serie", { data: null, isError: false, isFetching: false })).toBe("none");
    expect(seriesPrefStateOf("serie", { data: undefined, isError: true, isFetching: false })).toBe("none");
    // Requête en pause (réseau coupé) : on n'attend pas.
    expect(seriesPrefStateOf("serie", { data: undefined, isError: false, isFetching: false })).toBe("none");
    expect(seriesPrefStateOf(undefined, { data: undefined, isError: false, isFetching: true })).toBe("none");
  });
});

describe("lecture locale : la série d'abord, puis le contenu, puis la bibliothèque", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    });
    store.set("tentacle_user", JSON.stringify({ Id: "moi" }));
    cacheLibraryPrefs("moi", [{ libraryId: "biblio", audioLang: "fre", subtitleLang: null, subtitleMode: "none" }]);
    rememberItemTracks("ep7", { audioLang: "eng", subtitleLang: "eng", subtitleMode: "always" });
  });

  const ask = () => localTrackPrefFor({ userId: "moi", seriesId: "serie", itemId: "ep7", libraryId: "biblio" });

  it("sans série cochée, le choix propre à l'épisode (comme avant)", () => {
    expect(ask()?.audioLang).toBe("eng");
  });

  it("série cochée : elle l'emporte sur l'épisode, audio ET sous-titres", () => {
    mirrorSeriesPref("moi", "serie", { audioLang: "jpn", subtitleLang: "fre", subtitleMode: "always" });
    expect(ask()).toMatchObject({ audioLang: "jpn", subtitleLang: "fre", subtitleMode: "always" });
    // Décochée : l'épisode reprend la main, la bibliothèque n'a pas bougé.
    mirrorSeriesPref("moi", "serie", null);
    expect(ask()?.audioLang).toBe("eng");
    expect(localTrackPrefFor({ userId: "moi", seriesId: null, itemId: "autre", libraryId: "biblio" })?.audioLang).toBe("fre");
  });

  it("ne prend jamais la préférence d'une bibliothèque pour celle d'une série", () => {
    // Une seule préférence en cache : `prefForLibrary` la rendrait par repli.
    expect(seriesPrefFor("moi", "serie")).toBeNull();
  });
});
