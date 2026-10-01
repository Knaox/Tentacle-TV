import { describe, expect, it } from "vitest";
import { titleProvider } from "./pluginTitles";
import {
  MAX_MY_TITLES,
  MY_TITLE_STATE_KEYS,
  MY_TITLE_STATES,
  myTitlesUrl,
  readMyTitle,
  readMyTitles,
  readTitlesAccess,
  titlesAccessUrl,
} from "./pluginTitlesMine";

const vigie = {
  pluginId: "seer",
  configEnabled: true,
  titles: { state: "/titles/state", request: "/titles/request", access: "/titles/access", mine: "/titles/mine" },
};

const arriving = {
  key: "tv:1399", title: "Game of Thrones", year: 2011, imageUrl: "https://image.tmdb.org/t/p/w185/a.jpg",
  seasons: [3, 2, 3], state: "arriving", percent: 42.7,
};

describe("les routes du compte dans le contrat titles", () => {
  it("se lisent sur la déclaration, sous la racine du plugin", () => {
    const provider = titleProvider([vigie])!;
    expect(provider).toMatchObject({ accessPath: "/titles/access", minePath: "/titles/mine" });
    expect(titlesAccessUrl(provider)).toBe("/api/plugins/seer/titles/access");
    expect(myTitlesUrl(provider, "fr")).toBe("/api/plugins/seer/titles/mine?lang=fr");
  });

  it("manquent sans rien casser chez un plugin d'avant, ou mal formées", () => {
    const old = titleProvider([{ ...vigie, titles: { state: "/titles/state", request: "/titles/request" } }])!;
    expect(old).toMatchObject({ accessPath: null, minePath: null, requestPath: "/titles/request" });
    expect(titlesAccessUrl(old)).toBeNull();
    expect(myTitlesUrl(old, "fr")).toBeNull();
    const bad = titleProvider([{ ...vigie, titles: { state: "/s", access: "//evil.example/x", mine: "https://x.y" } }])!;
    expect(bad).toMatchObject({ statePath: "/s", accessPath: null, minePath: null });
  });
});

describe("le droit du compte", () => {
  it("ne s'ouvre que sur un booléen explicite", () => {
    expect(readTitlesAccess({ request: true })).toEqual({ request: true });
    expect(readTitlesAccess({ request: false })).toEqual({ request: false });
    for (const raw of [null, undefined, "yes", {}, { request: "true" }, { request: 1 }]) {
      expect(readTitlesAccess(raw), JSON.stringify(raw)).toBeNull();
    }
  });
});

describe("un titre attendu", () => {
  it("se lit champ par champ : saisons triées sans doublon, avancement gardé", () => {
    expect(readMyTitle(arriving)).toEqual({
      key: "tv:1399", mediaType: "tv", tmdbId: 1399, title: "Game of Thrones", year: 2011,
      imageUrl: "https://image.tmdb.org/t/p/w185/a.jpg", seasons: [2, 3], state: "arriving", percent: 42.7,
    });
  });

  it("n'a d'avancement qu'en route, borné de 0 à 100", () => {
    expect(readMyTitle({ ...arriving, percent: 140 })?.percent).toBe(100);
    expect(readMyTitle({ ...arriving, percent: -3 })?.percent).toBe(0);
    expect(readMyTitle({ ...arriving, percent: null })?.percent).toBeNull();
    for (const state of ["pending", "importing", "blocked"]) {
      expect(readMyTitle({ ...arriving, state, percent: 60 })?.percent, state).toBeNull();
    }
  });

  it("ignore ce qui est mal formé sans écarter le titre", () => {
    const title = readMyTitle({ ...arriving, year: "vers 2011", imageUrl: "javascript:alert(1)", seasons: ["2", -1, 1.5] });
    expect(title).toMatchObject({ year: null, imageUrl: null, seasons: null });
    expect(readMyTitle({ ...arriving, year: "2011" })?.year).toBe(2011);
    expect(readMyTitle({ key: "movie:603", title: "Matrix", state: "pending", seasons: [1] })?.seasons).toBeNull();
  });

  it("est écarté sans clé, sans titre, ou dans un état inconnu de ce client", () => {
    for (const raw of [
      { ...arriving, key: "series:1399" },
      { ...arriving, key: 1399 },
      { ...arriving, title: "  " },
      { ...arriving, state: "partial" },
      { ...arriving, state: undefined },
      null,
      "tv:1399",
    ]) {
      expect(readMyTitle(raw), JSON.stringify(raw)).toBeNull();
    }
  });
});

describe("la liste des titres attendus", () => {
  it("garde l'ordre du plugin, un titre par clé", () => {
    const list = readMyTitles({
      items: [
        { key: "movie:603", title: "Matrix", state: "pending" },
        arriving,
        { key: "movie:603", title: "Matrix (doublon)", state: "blocked" },
        { key: "movie:11", title: "Star Wars", state: "importing" },
      ],
    });
    expect(list.map((t) => [t.key, t.state])).toEqual([
      ["movie:603", "pending"], ["tv:1399", "arriving"], ["movie:11", "importing"],
    ]);
  });

  it("est vide sur une réponse illisible, et bornée", () => {
    for (const raw of [null, {}, { items: {} }, { items: "x" }, []]) expect(readMyTitles(raw)).toEqual([]);
    const many = Array.from({ length: MAX_MY_TITLES + 10 }, (_, i) => ({ key: `movie:${i + 1}`, title: `T${i}`, state: "pending" }));
    expect(readMyTitles({ items: many })).toHaveLength(MAX_MY_TITLES);
  });
});

describe("les mots des états", () => {
  it("ont une clé par état, dans l'espace requests", () => {
    expect(Object.keys(MY_TITLE_STATE_KEYS).sort()).toEqual([...MY_TITLE_STATES].sort());
    for (const key of Object.values(MY_TITLE_STATE_KEYS)) expect(key).toMatch(/^requests:state[A-Z]\w+$/);
  });
});
