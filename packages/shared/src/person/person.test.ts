import { describe, expect, it } from "vitest";
import {
  ageBetween, biographyParagraphs, formatCalendarDate, personLife, readJellyfinDate,
} from "./personProfile";
import {
  backdropSource, creditRoleKey, filmographyFacets, filterFilmography, normalizeCreditRole,
  type FilmographyEntry,
} from "./filmography";

describe("readJellyfinDate — le jour, pas l'instant", () => {
  it("le minuit local d'un serveur à Paris retombe sur le bon jour", () => {
    expect(readJellyfinDate("1937-06-30T23:00:00.0000000Z")).toEqual({ year: 1937, month: 7, day: 1 });
  });

  it("un serveur à l'ouest de Greenwich aussi", () => {
    expect(readJellyfinDate("1964-09-02T05:00:00Z")).toEqual({ year: 1964, month: 9, day: 2 });
  });

  it("rien, une chaîne vide ou la date nulle de Jellyfin ne font pas une date", () => {
    expect(readJellyfinDate(undefined)).toBeNull();
    expect(readJellyfinDate("")).toBeNull();
    expect(readJellyfinDate("pas une date")).toBeNull();
    expect(readJellyfinDate("0001-01-01T00:00:00Z")).toBeNull();
  });
});

describe("personLife — naissance, décès, âge", () => {
  const today = { year: 2026, month: 9, day: 28 };

  it("l'âge d'aujourd'hui, anniversaire passé ou non", () => {
    expect(ageBetween({ year: 1964, month: 9, day: 2 }, today)).toBe(62);
    expect(ageBetween({ year: 1964, month: 10, day: 2 }, today)).toBe(61);
    expect(ageBetween({ year: 1964, month: 9, day: 28 }, today)).toBe(62);
  });

  it("l'âge au décès, pas celui qu'on aurait aujourd'hui", () => {
    const life = personLife({ Id: "x", Name: "X", PremiereDate: "1930-08-25T00:00:00Z", EndDate: "2020-10-31T00:00:00Z" }, today);
    expect(life.died).toEqual({ year: 2020, month: 10, day: 31 });
    expect(life.age).toBe(90);
  });

  it("le lieu de naissance : le premier renseigné", () => {
    const life = personLife({ Id: "x", Name: "X", ProductionLocations: ["", " Memphis, Tennessee, USA "] }, today);
    expect(life.birthPlace).toBe("Memphis, Tennessee, USA");
    expect(life.born).toBeNull();
    expect(life.age).toBeNull();
  });

  it("une personne inconnue ne casse rien", () => {
    expect(personLife(undefined, today)).toEqual({ born: null, died: null, age: null, birthPlace: null });
  });
});

describe("formatCalendarDate", () => {
  it("dans la langue de l'interface, sans décalage de fuseau", () => {
    expect(formatCalendarDate({ year: 1937, month: 7, day: 1 }, "en-US")).toBe("July 1, 1937");
    expect(formatCalendarDate({ year: 1937, month: 7, day: 1 }, "fr")).toMatch(/1(er)? juillet 1937/);
  });
});

describe("biographyParagraphs", () => {
  it("un paragraphe par bloc, les retours simples fondus", () => {
    expect(biographyParagraphs("Né à Memphis.\r\n\r\nAyant commencé\nau théâtre.\n\n\n")).toEqual([
      "Né à Memphis.",
      "Ayant commencé au théâtre.",
    ]);
    expect(biographyParagraphs(undefined)).toEqual([]);
  });
});

function entry(id: string, type: string, role: string | null, extra: Partial<FilmographyEntry["item"]> = {}): FilmographyEntry {
  return { item: { Id: id, Name: id, Type: type, ...extra }, role };
}

describe("filmographie — facettes et filtres", () => {
  const entries = [
    entry("a", "Movie", "Actor"),
    entry("b", "Series", "GuestStar"),
    entry("c", "Movie", "Director"),
    entry("d", "Movie", "Actor"),
    entry("e", "Series", "Lyricist"),
    entry("f", "BoxSet", null),
  ];

  it("GuestStar joue ; un crédit qu'on ne sait pas nommer reste « autre »", () => {
    expect(normalizeCreditRole("GuestStar")).toBe("Actor");
    expect(normalizeCreditRole("Lyricist")).toBe("Other");
    expect(normalizeCreditRole(null)).toBeNull();
    expect(creditRoleKey("Director")).toBe("roleDirector");
  });

  it("compte films, séries et rôles, les plus fréquents d'abord", () => {
    expect(filmographyFacets(entries)).toEqual({
      total: 6,
      movies: 3,
      series: 2,
      roles: [{ role: "Actor", count: 3 }, { role: "Director", count: 1 }, { role: "Other", count: 1 }],
    });
  });

  it("filtre par type et par rôle, ensemble", () => {
    expect(filterFilmography(entries, { kind: "movie", role: "Actor" }).map((e) => e.item.Id)).toEqual(["a", "d"]);
    expect(filterFilmography(entries, { kind: "series", role: null }).map((e) => e.item.Id)).toEqual(["b", "e"]);
    expect(filterFilmography(entries, { kind: "all", role: null })).toHaveLength(6);
  });

  it("le décor vient du titre le mieux noté qui en a un", () => {
    const src = backdropSource([
      entry("sans", "Movie", "Actor", { CommunityRating: 9.9 }),
      entry("moyen", "Movie", "Actor", { CommunityRating: 6, BackdropImageTags: ["t"] }),
      entry("bon", "Movie", "Actor", { CommunityRating: 8.1, BackdropImageTags: ["t"] }),
    ]);
    expect(src?.Id).toBe("bon");
    expect(backdropSource([])).toBeNull();
  });
});
