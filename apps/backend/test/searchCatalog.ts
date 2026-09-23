/**
 * Une petite bibliothèque factice pour les tests du moteur et du service —
 * de quoi éprouver fautes, accents, ordre des mots, numéros, casting, genres.
 */

import type { CatalogItem, CatalogPersonRef } from "../src/services/search/catalogSource";

let next = 0;

function id(): string {
  next += 1;
  return next.toString(16).padStart(32, "0");
}

export const PEOPLE = {
  hanks: { id: "a".repeat(32), name: "Tom Hanks", role: "Actor" },
  wright: { id: "b".repeat(32), name: "Robin Wright", role: "Actor" },
  zemeckis: { id: "c".repeat(32), name: "Robert Zemeckis", role: "Director" },
  villeneuve: { id: "d".repeat(32), name: "Denis Villeneuve", role: "Director" },
  radcliffe: { id: "e".repeat(32), name: "Daniel Radcliffe", role: "Actor" },
  secret: { id: "f".repeat(32), name: "Personne Secrète", role: "Actor" },
  stan: { id: "1".repeat(32), name: "Sebastian Stan", role: "Actor" },
  squibb: { id: "2".repeat(32), name: "June Squibb", role: "Actor" },
  dicaprio: { id: "3".repeat(32), name: "Leonardo DiCaprio", role: "Actor" },
  deniro: { id: "4".repeat(32), name: "Robert De Niro", role: "Actor" },
  piper: { id: "5".repeat(32), name: "Piper Curda", role: "Actor" },
  finn: { id: "6".repeat(32), name: "Finn Bennett", role: "Actor" },
} satisfies Record<string, CatalogPersonRef>;

export function item(partial: Partial<CatalogItem> & Pick<CatalogItem, "name">): CatalogItem {
  return {
    id: id(),
    type: "Movie",
    originalTitle: null,
    year: null,
    endYear: null,
    endDate: null,
    rating: null,
    officialRating: null,
    runTimeTicks: null,
    childCount: null,
    status: null,
    genres: [],
    studios: [],
    people: [],
    personImages: {},
    imageTags: { Primary: "tag" },
    backdropTag: null,
    primaryAspect: null,
    dateCreated: null,
    ...partial,
  };
}

export function sampleCatalog(): CatalogItem[] {
  return [
    item({ name: "Forrest Gump", year: 1994, rating: 8.5, genres: ["Drame", "Comédie"], people: [PEOPLE.hanks, PEOPLE.wright, PEOPLE.zemeckis] }),
    item({ name: "Cast Away", year: 2000, rating: 7.8, genres: ["Aventure", "Drame"], people: [PEOPLE.hanks, PEOPLE.zemeckis] }),
    item({ name: "Harry Potter à l'école des sorciers", originalTitle: "Harry Potter and the Philosopher's Stone", year: 2001, rating: 7.6, genres: ["Fantastique"], people: [PEOPLE.radcliffe] }),
    item({ name: "Harry Potter et la Chambre des secrets", year: 2002, rating: 7.4, genres: ["Fantastique"], people: [PEOPLE.radcliffe] }),
    item({ name: "Harry Potter - Collection", type: "BoxSet", genres: ["Fantastique"] }),
    item({ name: "Dune", year: 1984, rating: 6.3, genres: ["Science-Fiction"] }),
    item({ name: "Dune", year: 2021, rating: 7.8, genres: ["Science-Fiction"], people: [PEOPLE.villeneuve] }),
    item({ name: "Spider-Man: No Way Home", year: 2021, rating: 8.0, genres: ["Action"] }),
    item({ name: "Rocky II", year: 1979, rating: 7.3, genres: ["Drame"] }),
    item({ name: "L'Œil du tigre", year: 1990, genres: ["Documentaire"] }),
    item({ name: "Pokémon, le film", year: 1998, genres: ["Animation"] }),
    item({ name: "It", year: 2017, rating: 7.3, genres: ["Horreur"] }),
    item({ name: "The Office", type: "Series", year: 2005, endYear: 2013, rating: 8.9, genres: ["Comédie"] }),
    item({ name: "Breaking Bad", type: "Series", year: 2008, endYear: 2013, rating: 9.5, genres: ["Drame", "Crime"] }),
    item({ name: "Film secret", year: 2020, genres: ["Drame"], people: [PEOPLE.secret] }),
    // Les pièges relevés sur une vraie bibliothèque (23.09.2026).
    item({ name: "Seul sur Mars", year: 2015, rating: 7.7, genres: ["Science-Fiction"], people: [PEOPLE.stan] }),
    item({ name: "Nebraska", year: 2013, rating: 7.7, genres: ["Drame"], people: [PEOPLE.squibb] }),
    item({ name: "El Camino : Un film « Breaking Bad »", year: 2019, rating: 6.9, genres: ["Crime"] }),
    item({ name: "First Man - Le Premier Homme sur la Lune", year: 2018, rating: 7.3, genres: ["Drame"] }),
    item({ name: "Inception", year: 2010, rating: 8.4, genres: ["Science-Fiction"], people: [PEOPLE.dicaprio] }),
    item({ name: "Les Affranchis", year: 1990, rating: 8.5, genres: ["Crime"], people: [PEOPLE.deniro] }),
    item({ name: "WALL·E", year: 2008, rating: 8.1, genres: ["Animation"], studios: ["Pixar"] }),
    item({ name: "Un film de lycée", year: 2019, genres: ["Comédie"], people: [PEOPLE.piper] }),
    item({ name: "Avatar", year: 2009, rating: 7.6, genres: ["Science-Fiction"], studios: ["Dune Entertainment"] }),
    item({ name: "Backrooms", year: 2024, genres: ["Horreur"], people: [PEOPLE.finn] }),
  ];
}
