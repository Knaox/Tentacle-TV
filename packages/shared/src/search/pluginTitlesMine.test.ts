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
  seasonRuns,
  titlesAccessUrl,
  withMyTitle,
} from "./pluginTitlesMine";

const vigie = {
  pluginId: "seer",
  configEnabled: true,
  titles: { state: "/titles/state", request: "/titles/request", access: "/titles/access", mine: "/titles/mine" },
};

const arriving = {
  key: "tv:1399", title: "Game of Thrones", year: 2011, imageUrl: "https://image.tmdb.org/t/p/w185/a.jpg",
  seasons: [3, 2, 3], state: "arriving", percent: 42.7, etaSeconds: 754.4,
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
      etaSeconds: 754,
    });
  });

  it("n'a de temps restant qu'en route, en secondes entières, et lisible", () => {
    expect(readMyTitle({ ...arriving, etaSeconds: undefined })?.etaSeconds).toBeNull();
    for (const etaSeconds of [0, -5, "600", Number.NaN, Number.POSITIVE_INFINITY, 8 * 24 * 3600]) {
      expect(readMyTitle({ ...arriving, etaSeconds })?.etaSeconds, String(etaSeconds)).toBeNull();
    }
    for (const state of ["pending", "importing", "blocked"]) {
      expect(readMyTitle({ ...arriving, state, etaSeconds: 600 })?.etaSeconds, state).toBeNull();
    }
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

describe("un titre qu'on vient de demander", () => {
  it("passe en tête, sans doublon", () => {
    const matrix = readMyTitle({ key: "movie:603", title: "Matrix", state: "pending" })!;
    const got = readMyTitle(arriving)!;
    expect(withMyTitle([got], matrix).map((t) => t.key)).toEqual(["movie:603", "tv:1399"]);
    expect(withMyTitle([got, matrix], matrix).map((t) => t.key)).toEqual(["movie:603", "tv:1399"]);
    expect(withMyTitle([], matrix)).toEqual([matrix]);
  });
});

describe("les saisons demandées, en morceaux", () => {
  it("font un intervalle à partir de trois de suite", () => {
    expect(seasonRuns([1, 2, 3, 4, 6])).toEqual(["1–4", "6"]);
    expect(seasonRuns([2, 3])).toEqual(["2", "3"]);
    expect(seasonRuns([5, 1, 3, 2])).toEqual(["1–3", "5"]);
    expect(seasonRuns([0, 1, 2, 7, 8, 9, 11])).toEqual(["0–2", "7–9", "11"]);
    expect(seasonRuns([4, 4])).toEqual(["4"]);
    expect(seasonRuns([])).toEqual([]);
  });
});
