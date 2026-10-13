/**
 * Les raisons structurées mises en mots, avec les VRAIS textes FR : le
 * serveur donne des faits, le client parle — et retombe sur les raisons
 * historiques quand le serveur n'en dit rien.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { i18n, initI18n } from "@tentacle-tv/shared";
import type { RecoRowItem, RecoWhy } from "../hooks/recoTypes";
import type { RecoPage } from "../hooks/useRecoPage";
import { recoSpotlightOf } from "./recoSpotlight";
import { recoItemReasonText, recoMatchOf, recoRowTitleText, recoWhyText } from "./recoWhyText";

// Le vrai i18next de l'app, en français : les vraies phrases, interpolées.
let t: (key: string, opts?: Record<string, unknown>) => string;
beforeAll(async () => {
  initI18n({ lng: "fr" });
  await i18n.changeLanguage("fr");
  const fixed = i18n.getFixedT("fr", "reco");
  t = (key, opts) => fixed(key, { ...opts, interpolation: { escapeValue: false } });
});

const item = (key: string, over: Partial<RecoRowItem> = {}): RecoRowItem => ({
  key, mediaType: "movie", tmdbId: Number(key.split(":")[1]), title: key, year: null, posterPath: null,
  backdropPath: null, jellyfinItemId: null, source: "x", score: 1, voteAverage: null, reasons: [], ...over,
});

describe("recoWhyText", () => {
  it("dit chaque raison en une phrase, au vouvoiement", () => {
    const cases: Array<[RecoWhy, string]> = [
      [{ kind: "similarTo", titles: [{ key: "tv:1920", title: "Twin Peaks" }, { key: "tv:54344", title: "The Leftovers" }], signal: "loved" }, "Parce que vous avez adoré Twin Peaks et The Leftovers"],
      [{ kind: "person", person: { id: 137427, name: "Denis Villeneuve" }, role: "director", via: { key: "movie:146233", title: "Prisoners" } }, "Du réalisateur de Prisoners"],
      [{ kind: "person", person: { id: 947, name: "Hans Zimmer" }, role: "composer" }, "Musique de Hans Zimmer"],
      [{ kind: "theme", theme: { key: "kw:9748", label: "twist", tag: "twist" }, via: { key: "movie:1124", title: "Le Prestige" } }, "Retournements de situation, comme Le Prestige"],
      [{ kind: "company", company: { id: 49, name: "HBO", kind: "network" } }, "Une série HBO"],
      [{ kind: "hiddenGem", rating: 8.4, votes: 900 }, "Pépite méconnue · 8.4/10"],
      [{ kind: "recent", year: 2026 }, "Nouveauté 2026"],
      [{ kind: "exploration" }, "Pour sortir de vos habitudes"],
    ];
    for (const [why, text] of cases) expect(recoWhyText(why, t)).toBe(text);
  });

  it("en français, l'élision suit le titre cité", () => {
    const why: RecoWhy = { kind: "person", person: { id: 15277, name: "Jon Favreau" }, role: "director", via: { key: "movie:1726", title: "Iron Man" } };
    expect(recoWhyText(why, t, { locale: "fr" })).toBe("Du réalisateur d'Iron Man");
    const theme: RecoWhy = { kind: "theme", theme: { key: "kw:1", label: "twist", tag: "twist" }, via: { key: "movie:1124", title: "Le Prestige" } };
    expect(recoWhyText(theme, t, { locale: "fr" })).toBe("Retournements de situation, comme Le Prestige");
  });

  it("le titre d'une rangée prend la forme collective", () => {
    expect(recoWhyText({ kind: "hiddenGem", rating: 8.4, votes: 900 }, t, { row: true })).toBe("Pépites méconnues");
    expect(recoWhyText({ kind: "person", person: { id: 1, name: "David Fincher" }, role: "director" }, t, { row: true }))
      .toBe("Réalisés par David Fincher");
  });
});

describe("recoItemReasonText", () => {
  const seedReason = { kind: "seed" as const, seedTitle: "Cowboy Bebop" };
  const director = { kind: "facet" as const, key: "director:1", label: "Hayao Miyazaki" };

  it("la raison structurée d'abord, sinon l'historique", () => {
    expect(recoItemReasonText(item("movie:1", { why: [{ kind: "recent", year: 2026 }], reasons: [director] }), t)).toBe("Nouveauté 2026");
    expect(recoItemReasonText(item("movie:1", { reasons: [director] }), t)).toBe("Réalisé par Hayao Miyazaki");
  });

  it("une raison qui répète le titre de sa rangée est sautée", () => {
    const row = { seedTitle: "Cowboy Bebop" };
    expect(recoItemReasonText(item("tv:1", { reasons: [seedReason, director] }), t, { row })).toBe("Réalisé par Hayao Miyazaki");
    const theme: RecoWhy = { kind: "theme", theme: { key: "kw:1", label: "twist", tag: "twist" } };
    expect(recoItemReasonText(item("tv:1", { why: [theme, { kind: "recent", year: 2025 }] }), t, { row: { why: theme } }))
      .toBe("Nouveauté 2025");
  });

  it("une raison d'un kind inconnu (serveur plus récent) est ignorée", () => {
    const unknown = { kind: "future" } as unknown as RecoWhy;
    expect(recoItemReasonText(item("movie:1", { why: [unknown], reasons: [director] }), t)).toBe("Réalisé par Hayao Miyazaki");
  });
});

describe("recoRowTitleText, recoMatchOf", () => {
  it("une rangée à thème se titre par son thème, les autres par leur clé", () => {
    expect(recoRowTitleText({ key: "theme:7f3a", why: { kind: "theme", theme: { key: "kw:9748", label: "twist", tag: "twist" } } }, t))
      .toBe("Retournements de situation");
    expect(recoRowTitleText({ key: "becauseYouLiked:tv:1", seedTitle: "Twin Peaks" }, t)).toBe("Parce que vous avez aimé Twin Peaks");
    // « Films pour vous » (serveur 1.27.1, 2ᵉ rangée) : sa clé a son titre.
    expect(recoRowTitleText({ key: "forYouMovies" }, t)).toBe("Films pour vous");
  });

  it("la correspondance n'existe que bornée", () => {
    expect(recoMatchOf({ match: 92 })).toBe(92);
    expect(recoMatchOf({})).toBeNull();
    expect(recoMatchOf({ match: 140 })).toBeNull();
  });
});

describe("recoSpotlightOf", () => {
  const page = (over: Partial<RecoPage>): RecoPage => ({
    state: "ready", signalCount: 30, generating: false, refining: false, exploring: false, generatedAt: null,
    poolGeneratedAt: null, tmdbConfigured: true, personalized: true, filter: null, rows: [], ...over,
  });
  const forYou = [item("movie:1"), item("movie:2", { backdropPath: "/b.jpg" }), item("movie:3", { jellyfinItemId: "j3" }), item("movie:4", { backdropPath: "/d.jpg" })];

  it("le « à la une » du serveur d'abord, les suivantes de « Pour vous » ensuite", () => {
    const spot = recoSpotlightOf(page({ rows: [{ key: "forYou", items: forYou }], featured: { item: forYou[3], rowKey: "forYou" } }));
    expect(spot.featured?.key).toBe("movie:4");
    expect(spot.alternatives.map((i) => i.key)).toEqual(["movie:2", "movie:3"]);
  });

  it("serveur d'avant : la tête de « Pour vous » qui a un visuel large", () => {
    const spot = recoSpotlightOf(page({ rows: [{ key: "forYou", items: forYou }] }));
    expect(spot.featured?.key).toBe("movie:2");
    expect(recoSpotlightOf(undefined).featured).toBeUndefined();
  });
});
