import { describe, expect, it } from "vitest";
import {
  personProviderUrl, providerAccepts, providerUrl, readExternalResponse, searchProviders, shortPluginName,
  withoutLibraryTwins, type SearchablePlugin, type SearchProvider,
} from "./pluginSearch";

type TestPlugin = SearchablePlugin & { id: string; version: string; hasBundle: boolean; navItems: unknown[] };

function plugin(partial: Partial<TestPlugin>): TestPlugin {
  return {
    id: "uuid", pluginId: "seer", name: "Vigie — Jellyseerr (unofficial)", version: "2.0.0",
    hasBundle: true, configEnabled: true, navItems: [], ...partial,
  };
}

const PROVIDER: SearchProvider = {
  pluginId: "seer", path: "/search/provider", personPath: null, types: ["movie", "series"], label: "Ailleurs", source: "Vigie",
};

describe("searchProviders — qui sait chercher hors bibliothèque", () => {
  it("un plugin actif, configuré et qui déclare search", () => {
    const [p] = searchProviders(
      [plugin({ search: { path: "/search/provider", types: ["movie"], labels: { fr: "Pas encore là", en: "Not here yet" } } })],
      "fr", "Hors bibliothèque",
    );
    expect(p).toEqual({ pluginId: "seer", path: "/search/provider", personPath: null, types: ["movie"], label: "Pas encore là", source: "Vigie" });
  });

  it("la route de filmographie est relayée — ignorée seule si elle sort du plugin", () => {
    expect(searchProviders([plugin({ search: { path: "/s", person: "/search/person" } })], "fr", "x")[0].personPath).toBe("/search/person");
    expect(searchProviders([plugin({ search: { path: "/s", person: "//evil.example" } })], "fr", "x")[0].personPath).toBeNull();
  });

  it("la filmographie se demande par nom, et par identifiant TMDB s'il est connu", () => {
    const provider = { ...PROVIDER, personPath: "/search/person" };
    expect(personProviderUrl(provider, { name: "Keanu Reeves", tmdbId: "6384" }, { lang: "fr", limit: 20 }))
      .toBe("/api/plugins/seer/search/person?name=Keanu+Reeves&lang=fr&limit=20&tmdb=6384");
    expect(personProviderUrl(provider, { name: "Keanu Reeves", tmdbId: null }, { lang: "fr", limit: 20 }))
      .toBe("/api/plugins/seer/search/person?name=Keanu+Reeves&lang=fr&limit=20");
  });

  it("aucun plugin, ou intégration éteinte, ou pas de search : aucune source", () => {
    expect(searchProviders([], "fr", "x")).toEqual([]);
    expect(searchProviders([plugin({ configEnabled: false, search: { path: "/s" } })], "fr", "x")).toEqual([]);
    expect(searchProviders([plugin({})], "fr", "x")).toEqual([]);
  });

  it("un chemin qui sortirait du plugin est ignoré", () => {
    expect(searchProviders([plugin({ search: { path: "//evil.example" } })], "fr", "x")).toEqual([]);
    expect(searchProviders([plugin({ search: { path: "/../admin" } })], "fr", "x")).toEqual([]);
  });

  it("libellé : la langue, puis l'anglais, puis le repli", () => {
    expect(searchProviders([plugin({ search: { path: "/s", labels: { en: "Elsewhere" } } })], "de", "x")[0].label).toBe("Elsewhere");
    expect(searchProviders([plugin({ search: { path: "/s" } })], "fr", "Hors bibliothèque")[0].label).toBe("Hors bibliothèque");
  });

  it("le nom court du plugin se lit avant le tiret", () => {
    expect(shortPluginName("Vigie — Jellyseerr (unofficial)")).toBe("Vigie");
    expect(shortPluginName("Radar")).toBe("Radar");
  });
});

describe("providerUrl / providerAccepts", () => {
  it("interroge la route du plugin avec la requête, la langue et le type", () => {
    expect(providerUrl(PROVIDER, "dune 2021", { lang: "fr", limit: 6, kind: "movie" }))
      .toBe("/api/plugins/seer/search/provider?q=dune+2021&lang=fr&limit=6&type=movie");
  });

  it("un plugin qui ne cherche que des films n'est pas interrogé pour une bibliothèque de séries", () => {
    expect(providerAccepts({ ...PROVIDER, types: ["movie"] }, "series")).toBe(false);
    expect(providerAccepts({ ...PROVIDER, types: null }, "series")).toBe(true);
    expect(providerAccepts(PROVIDER, null)).toBe(true);
  });
});

describe("readExternalResponse — la réponse d'un plugin, validée", () => {
  const good = {
    id: "movie:603", kind: "movie", title: "Matrix", year: 1999, subtitle: "Film · 1999",
    imageUrl: "https://image.tmdb.org/t/p/w185/x.jpg", href: "/discover?media=movie:603",
    badge: { label: "Demandé", tone: "info" },
  };

  it("garde les éléments bien formés", () => {
    const r = readExternalResponse({ query: "matrix", correction: null, complete: false, items: [good], moreHref: "/discover?q=matrix" }, PROVIDER);
    expect(r?.items).toEqual([good]);
    expect(r?.complete).toBe(false);
    expect(r?.moreHref).toBe("/discover?q=matrix");
  });

  it("écarte les liens vers un autre site et les images douteuses", () => {
    const r = readExternalResponse({
      items: [
        { ...good, id: "a", href: "https://evil.example" },
        { ...good, id: "b", href: "//evil.example/x" },
        { ...good, id: "c", imageUrl: "javascript:alert(1)" },
      ],
      moreHref: "https://evil.example",
    }, PROVIDER);
    expect(r?.items.map((i) => i.id)).toEqual(["c"]);
    expect(r?.items[0].imageUrl).toBeNull();
    expect(r?.moreHref).toBeNull();
  });

  it("dédoublonne, et une pastille au ton inconnu devient neutre", () => {
    const r = readExternalResponse({ items: [good, good, { ...good, id: "x", badge: { label: "Hmm", tone: "rainbow" } }] }, PROVIDER);
    expect(r?.items).toHaveLength(2);
    expect(r?.items[1].badge).toEqual({ label: "Hmm", tone: "neutral" });
  });

  it("une réponse illisible fait taire la section", () => {
    expect(readExternalResponse(null, PROVIDER)).toBeNull();
    expect(readExternalResponse({ items: "nope" }, PROVIDER)).toBeNull();
  });
});

describe("withoutLibraryTwins — rien de ce que la bibliothèque a déjà", () => {
  it("même titre plié et même année : écarté", () => {
    const items = readExternalResponse({ items: [
      { id: "1", title: "Amélie", year: 2001, href: "/d" },
      { id: "2", title: "Amélie", year: 1990, href: "/d" },
    ] }, PROVIDER)?.items ?? [];
    expect(withoutLibraryTwins(items, [{ name: "AMELIE", year: 2001 }]).map((i) => i.id)).toEqual(["2"]);
  });
});
