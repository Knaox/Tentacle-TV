/**
 * Ce qui est vérifié ici : une collection se filtre et se trie sans rien
 * redemander au serveur, et le tri par date n'est QUE la lecture de l'ordre
 * reçu — c'est le genre d'astuce qu'un relecteur prendrait pour un bug.
 */

import { describe, expect, it } from "vitest";
import type { MediaItem } from "@tentacle-tv/shared";
import { collectionGenres, filterCollection } from "./collectionFilter";
import type { CollectionFilterInput } from "./collectionFilter";

const NEUTRE: CollectionFilterInput = {
  search: "",
  type: "all",
  genres: [],
  yearFrom: null,
  yearTo: null,
  ratingMin: null,
  statusFilter: null,
  sortBy: "DateCreated",
  sortOrder: "Descending",
};

function item(p: Partial<MediaItem>): MediaItem {
  return { Id: "id", Name: "Titre", Type: "Movie", ...p } as MediaItem;
}

/** `UserItemData` réclame tous ses champs : ce raccourci ne dit que l'utile. */
function vu(p: Partial<MediaItem["UserData"]>): MediaItem["UserData"] {
  return { PlaybackPositionTicks: 0, PlayCount: 0, IsFavorite: false, Played: false, ...p };
}

const LISTE = [
  item({ Id: "a", Name: "Spider-Man", Type: "Movie", ProductionYear: 2002, CommunityRating: 7.3, Genres: ["Action"] }),
  item({ Id: "b", Name: "Breaking Bad", Type: "Series", ProductionYear: 2008, CommunityRating: 9.4, Genres: ["Drame", "Crime"] }),
  item({ Id: "c", Name: "Amélie", Type: "Movie", ProductionYear: 2001, Genres: ["Comédie"] }),
];

describe("filterCollection", () => {
  it("rend l'entrée PAR IDENTITÉ quand rien n'est demandé", () => {
    expect(filterCollection(LISTE, NEUTRE)).toBe(LISTE);
  });

  it("cherche sans se soucier des accents ni de la ponctuation", () => {
    const r = filterCollection(LISTE, { ...NEUTRE, search: "spider man" });
    expect(r.map((i) => i.Id)).toEqual(["a"]);
    expect(filterCollection(LISTE, { ...NEUTRE, search: "amelie" }).map((i) => i.Id)).toEqual(["c"]);
  });

  it("ignore une recherche d'un seul caractère", () => {
    expect(filterCollection(LISTE, { ...NEUTRE, search: "a" })).toBe(LISTE);
  });

  it("filtre par type", () => {
    expect(filterCollection(LISTE, { ...NEUTRE, type: "Series" }).map((i) => i.Id)).toEqual(["b"]);
  });

  it("filtre par genre, par NOM", () => {
    expect(filterCollection(LISTE, { ...NEUTRE, genres: ["Crime"] }).map((i) => i.Id)).toEqual(["b"]);
  });

  it("accepte une plage d'années ouverte d'un côté", () => {
    expect(filterCollection(LISTE, { ...NEUTRE, yearFrom: 2002 }).map((i) => i.Id)).toEqual(["a", "b"]);
    expect(filterCollection(LISTE, { ...NEUTRE, yearTo: 2001 }).map((i) => i.Id)).toEqual(["c"]);
  });

  it("écarte les titres sans note quand une note minimum est posée", () => {
    expect(filterCollection(LISTE, { ...NEUTRE, ratingMin: 7 }).map((i) => i.Id)).toEqual(["a", "b"]);
  });

  it("« non vus » garde ce qui n'est pas lu", () => {
    const liste = [
      item({ Id: "vu", UserData: vu({ Played: true }) }),
      item({ Id: "neuf" }),
    ];
    expect(filterCollection(liste, { ...NEUTRE, statusFilter: "IsUnplayed" }).map((i) => i.Id)).toEqual(["neuf"]);
  });

  it("« en cours » lit la position d'un film et les épisodes vus d'une série", () => {
    const liste = [
      item({ Id: "film-entame", UserData: vu({ PlaybackPositionTicks: 42 }) }),
      item({ Id: "film-neuf" }),
      item({ Id: "serie-entamee", Type: "Series", UserData: vu({ PlayCount: 3 }) }),
      item({ Id: "serie-finie", Type: "Series", UserData: vu({ PlayCount: 9, Played: true }) }),
    ];
    const r = filterCollection(liste, { ...NEUTRE, statusFilter: "IsResumable" });
    expect(r.map((i) => i.Id)).toEqual(["film-entame", "serie-entamee"]);
  });

  it("trie par titre, dans les deux sens", () => {
    const asc = filterCollection(LISTE, { ...NEUTRE, sortBy: "SortName", sortOrder: "Ascending" });
    expect(asc.map((i) => i.Id)).toEqual(["c", "b", "a"]);
    const desc = filterCollection(LISTE, { ...NEUTRE, sortBy: "SortName", sortOrder: "Descending" });
    expect(desc.map((i) => i.Id)).toEqual(["a", "b", "c"]);
  });

  it("trie par note et par année, les absents en dernier", () => {
    const note = filterCollection(LISTE, { ...NEUTRE, sortBy: "CommunityRating", sortOrder: "Descending" });
    expect(note.map((i) => i.Id)).toEqual(["b", "a", "c"]);
    const annee = filterCollection(LISTE, { ...NEUTRE, sortBy: "ProductionYear", sortOrder: "Ascending" });
    expect(annee.map((i) => i.Id)).toEqual(["c", "a", "b"]);
  });

  it("le tri par date n'est QUE l'ordre reçu, et son inverse", () => {
    const desc = filterCollection(LISTE, { ...NEUTRE, sortBy: "DateCreated", sortOrder: "Descending" });
    expect(desc.map((i) => i.Id)).toEqual(["a", "b", "c"]);
    const asc = filterCollection(LISTE, { ...NEUTRE, sortBy: "DateCreated", sortOrder: "Ascending" });
    expect(asc.map((i) => i.Id)).toEqual(["c", "b", "a"]);
  });

  it("combine plusieurs critères", () => {
    const r = filterCollection(LISTE, { ...NEUTRE, type: "Movie", yearFrom: 2002, ratingMin: 7 });
    expect(r.map((i) => i.Id)).toEqual(["a"]);
  });

  it("une liste vide reste vide", () => {
    expect(filterCollection([], { ...NEUTRE, search: "quoi" })).toEqual([]);
  });
});

describe("collectionGenres", () => {
  it("dédoublonne et trie les noms", () => {
    expect(collectionGenres(LISTE).map((g) => g.Name)).toEqual(["Action", "Comédie", "Crime", "Drame"]);
  });

  it("l'identifiant EST le nom — c'est ce que les items portent", () => {
    expect(collectionGenres(LISTE)[0]).toEqual({ Id: "Action", Name: "Action" });
  });

  it("écarte un nom contenant une virgule — le décodage des filtres découpe dessus", () => {
    const liste = [item({ Genres: ["Action, Aventure", "Drame"] })];
    expect(collectionGenres(liste).map((g) => g.Name)).toEqual(["Drame"]);
  });

  it("une liste sans genre ne propose rien", () => {
    expect(collectionGenres([item({})])).toEqual([]);
  });
});
