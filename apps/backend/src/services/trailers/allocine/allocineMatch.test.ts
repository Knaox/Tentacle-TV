import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { matchAllocineVideos, normalizeShowName, type AllocineMatchTitle, type AllocineVideo } from "./allocineMatch";
import { decodeEntities, parseAllocineTitle } from "./allocineTitle";

/*
 * Les fixtures sont les réponses RÉELLES de l'API publique de Dailymotion
 * (`/user/allocine/videos?search=…&fields=id,title,created_time,duration`),
 * relevées le 2026-10-14. Les dates TMDB des titres sont recopiées à la main.
 */
function fixture(...names: string[]): AllocineVideo[] {
  return names.flatMap((name) => {
    const page = JSON.parse(readFileSync(join(__dirname, "fixtures", `${name}.json`), "utf8")) as {
      list: Array<{ id: string; title: string; created_time: number; duration: number }>;
    };
    return page.list.map((v) => ({ id: v.id, title: v.title, createdTime: v.created_time, duration: v.duration }));
  });
}

const summary = (title: AllocineMatchTitle, ...names: string[]) =>
  matchAllocineVideos(fixture(...names), title).map((m) => `${m.scope.kind === "season" ? `s${m.scope.season}` : m.scope.kind} ${m.kind} ${m.version} ${m.videoId}`);

describe("AlloCiné › le titre d'une vidéo", () => {
  it("lit la saison, la partie, le rang et la version — toutes leurs écritures", () => {
    expect(parseAllocineTitle("Rick et Morty - saison 6 Bande-annonce VF"))
      .toEqual({ show: "Rick et Morty", season: 6, kind: "trailer", version: "vf" });
    expect(parseAllocineTitle("Rick et Morty - saison 5 Bande-annonce (2) VOST"))
      .toEqual({ show: "Rick et Morty", season: 5, kind: "trailer", index: 2, version: "vostfr" });
    expect(parseAllocineTitle("Rick et Morty - saison 4 partie 2 Bande-annonce VOST"))
      .toEqual({ show: "Rick et Morty", season: 4, part: 2, kind: "trailer", version: "vostfr" });
    expect(parseAllocineTitle("Rick et Morty - saison 9 Teaser VO STFR"))
      .toEqual({ show: "Rick et Morty", season: 9, kind: "teaser", version: "vostfr" });
    expect(parseAllocineTitle("Dune : Deuxième Partie Bande-annonce (3) VO"))
      .toEqual({ show: "Dune : Deuxième Partie", kind: "trailer", index: 3, version: "vo" });
  });

  it("décode les entités HTML", () => {
    expect(decodeEntities("Jodorowsky&#039;s Dune &amp; co &#x27;")).toBe("Jodorowsky's Dune & co '");
    expect(parseAllocineTitle("Bitchin&#039;: The Sound and Fury of Rick James Bande-annonce VO")?.show)
      .toBe("Bitchin': The Sound and Fury of Rick James");
  });

  it("ignore les extraits, interviews, bonus, clips, Faux Raccord et épisodes", () => {
    for (const raw of [
      "Rick et Morty - saison 8 EXTRAIT VO STFR \"Pâques en Allemagne\"",
      "Rick et Morty Vidéo clip VO",
      "Dune Making Of \"Imax\"",
      "Dune : Deuxième Partie BONUS VO \"Un message du cast\"",
      "Faux Raccord N°403 - Les gaffes et erreurs de A.I. Intelligence Artificielle",
      "La Jeune fille et les paysans INTERVIEW de Nadia Tereszkiewicz",
      "Breaking Bad - saison 5 - épisode 11 Teaser VO",
      "Breaking Bad - saison 3 Extrait vidéo VO",
    ]) expect(parseAllocineTitle(raw)).toBeNull();
  });

  it("le nom normalisé : casse, accents, ponctuation, & = et", () => {
    expect(normalizeShowName("The Bear : sur place ou à emporter")).toBe(normalizeShowName("The Bear : Sur place ou à emporter"));
    expect(normalizeShowName("Malcolm & Marie")).toBe("malcolm et marie");
    expect(normalizeShowName("Dune: Prophecy")).toBe(normalizeShowName("Dune : Prophecy"));
  });
});

const RICK: AllocineMatchTitle = {
  kind: "tv",
  names: ["Rick et Morty", "Rick and Morty"],
  releaseDate: "2013-12-02",
  lastAirDate: "2026-07-26",
  seasons: [
    { season: 1, airDate: "2013-12-02" }, { season: 2, airDate: "2015-07-26" }, { season: 3, airDate: "2017-04-01" },
    { season: 4, airDate: "2019-11-10" }, { season: 5, airDate: "2021-06-20" }, { season: 6, airDate: "2022-09-04" },
    { season: 7, airDate: "2023-10-15" }, { season: 8, airDate: "2025-05-25" }, { season: 9, airDate: "2026-05-24" },
  ],
};

describe("AlloCiné › les vidéos d'un titre (réponses réelles)", () => {
  it("Rick et Morty : chaque saison a les siennes, la VF de S6 en tête ; l'Anime et les homonymes n'en sont pas", () => {
    expect(summary(RICK, "rick-et-morty")).toEqual([
      "s6 trailer vf x8e90ff",
      "s9 trailer vostfr xa9l1fq",
      "s8 trailer vostfr x9jkc68",
      "s4 trailer vostfr x8a1sri",
      "s4 trailer vostfr x8a1rzz",
      // « (2) » : après les premières bandes-annonces des autres saisons (le rang les range ensuite par portée).
      "s5 trailer vostfr x8a2mn3",
      "s9 teaser vostfr xa1ucfa",
      "s9 trailer vo xa4n516",
      "s5 trailer vo x8a2ige",
      "s3 trailer vo x8a2yip",
    ]);
  });

  it("Dune (2021) : celles de 2020-2021 ; ni la VF de 2012, ni la VO STFR de 2026, ni Deuxième Partie", () => {
    const dune: AllocineMatchTitle = { kind: "movie", names: ["Dune", "Dune : Première partie"], releaseDate: "2021-09-15" };
    expect(summary(dune, "dune")).toEqual([
      "movie trailer vf x8a2zns", "movie trailer vf x8a313z", "movie trailer vo x8a30qg", "movie trailer vo x8a2ads",
    ]);
  });

  it("Malcolm : la série de 2000 n'a rien ; le « Malcolm » de 2012 est un homonyme", () => {
    const malcolm: AllocineMatchTitle = {
      kind: "tv", names: ["Malcolm", "Malcolm in the Middle"], releaseDate: "2000-01-09", lastAirDate: "2006-05-14",
      seasons: [{ season: 5, airDate: "2003-11-02" }],
    };
    expect(summary(malcolm, "malcolm")).toEqual([]);
  });

  it("The Bear : le nom court et le nom français valent le même titre", () => {
    const bear: AllocineMatchTitle = {
      kind: "tv", names: ["The Bear : Sur place ou à emporter", "The Bear"], releaseDate: "2022-06-23", lastAirDate: "2025-06-25",
      seasons: [
        { season: 1, airDate: "2022-06-23" }, { season: 2, airDate: "2023-06-22" }, { season: 3, airDate: "2024-06-26" },
        { season: 4, airDate: "2025-06-25" },
      ],
    };
    const found = summary(bear, "the-bear");
    // La saison 5 n'a pas encore de date chez TMDB : la fenêtre de la série (dernière diffusion + 18 mois) la couvre.
    expect(found.slice(0, 2)).toEqual(["s5 trailer vf xae4qvy", "s4 trailer vf x9jvtxs"]);
    expect(found.filter((line) => line.startsWith("s1"))).toEqual(["s1 trailer vo x8bcc4r", "s1 trailer vo x8b9vs7"]);
  });

  it("Breaking Bad : la VF de la série et celle de S1, sur deux pages ; El Camino et les épisodes n'en sont pas", () => {
    const breaking: AllocineMatchTitle = {
      kind: "tv", names: ["Breaking Bad"], releaseDate: "2008-01-20", lastAirDate: "2013-09-29",
      seasons: [
        { season: 1, airDate: "2008-01-20" }, { season: 2, airDate: "2009-03-08" }, { season: 3, airDate: "2010-03-21" },
        { season: 4, airDate: "2011-07-17" }, { season: 5, airDate: "2012-07-15" },
      ],
    };
    const found = summary(breaking, "breaking-bad", "breaking-bad-2", "breaking-bad");
    // La plus récente d'abord : la VF de la série (2011), puis celle de S1 (2009).
    expect(found.slice(0, 2)).toEqual(["series trailer vf x8a3gpb", "s1 trailer vf x8a1ko3"]);
    expect(found.every((line) => !line.includes("x8a3yn5") && !line.includes("x8a3oee"))).toBe(true);
    expect(new Set(found).size).toBe(found.length);
  });

  it("une durée hors de 15 s à 5 min, un film qui porte une saison : rien ; une saison sans date prend la fenêtre du titre", () => {
    const title: AllocineMatchTitle = { kind: "tv", names: ["X"], releaseDate: "2020-01-01", seasons: [{ season: 1, airDate: "2020-01-01" }] };
    const at = Date.parse("2020-01-01T00:00:00Z") / 1000;
    const videos: AllocineVideo[] = [
      { id: "short", title: "X - saison 1 Bande-annonce VF", createdTime: at, duration: 10 },
      { id: "long", title: "X - saison 1 Bande-annonce VF", createdTime: at, duration: 400 },
      { id: "nodate", title: "X - saison 2 Bande-annonce VF", createdTime: at, duration: 60 },
      { id: "nodate-late", title: "X - saison 2 Bande-annonce VF", createdTime: at + 3 * 365 * 86_400, duration: 60 },
      { id: "ok", title: "X - saison 1 Bande-annonce VF", createdTime: at, duration: 60 },
    ];
    expect(matchAllocineVideos(videos, title).map((m) => m.videoId)).toEqual(["nodate", "ok"]);
    // Sans date du titre, seule la saison datée passe.
    expect(matchAllocineVideos(videos, { ...title, releaseDate: null }).map((m) => m.videoId)).toEqual(["ok"]);
    expect(matchAllocineVideos(videos, { ...title, kind: "movie" })).toEqual([]);
  });

  it("une saison sans date qui n'est ni connue ni la suivante est celle d'un HOMONYME : rien", () => {
    const title: AllocineMatchTitle = {
      kind: "tv", names: ["X"], releaseDate: "2020-01-01", lastAirDate: "2022-01-01",
      seasons: [{ season: 1, airDate: "2020-01-01" }, { season: 2, airDate: "2021-01-01" }],
    };
    const at = Date.parse("2022-06-01T00:00:00Z") / 1000;
    const videos: AllocineVideo[] = [
      { id: "next", title: "X - saison 3 Bande-annonce VF", createdTime: at, duration: 60 },
      { id: "homonym", title: "X - saison 7 Bande-annonce VF", createdTime: at, duration: 60 },
    ];
    expect(matchAllocineVideos(videos, title).map((m) => m.videoId)).toEqual(["next"]);
  });

  it("la bande-annonce 1 avant la « (2) », à version et type égaux", () => {
    const title: AllocineMatchTitle = { kind: "movie", names: ["X"], releaseDate: "2020-01-01" };
    const at = Date.parse("2020-01-01T00:00:00Z") / 1000;
    const videos: AllocineVideo[] = [
      { id: "second", title: "X Bande-annonce (2) VF", createdTime: at + 86_400, duration: 60 },
      { id: "first", title: "X Bande-annonce VF", createdTime: at, duration: 60 },
    ];
    expect(matchAllocineVideos(videos, title).map((m) => m.videoId)).toEqual(["first", "second"]);
  });
});
