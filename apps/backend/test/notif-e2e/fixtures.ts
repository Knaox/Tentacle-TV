/**
 * Les données du banc : six comptes aux rôles distincts, la bibliothèque de
 * départ, et les contenus qui arriveront pendant le passage.
 *
 *  - alice : demande « The Bear » (S1) et « Dune » ; préférences par défaut ;
 *  - bob   : abonné à TOUS les ajouts ;
 *  - carol : rien demandé, rien coché — ne doit rien recevoir ;
 *  - dave  : demande « Inception » mais a coupé « Contenu demandé disponible » ;
 *  - eve   : demande « Dune: Part Two », interface en anglais ;
 *  - admin : le compte administrateur (Jellyfin et Jellyseerr).
 */

import type { FakeItem, FakeUser } from "./fakeJellyfin";

export const ADMIN: FakeUser = { Id: "ad000000000000000000000000000001", Name: "Admin", token: "tok-admin", admin: true };
export const ALICE: FakeUser = { Id: "a1000000000000000000000000000001", Name: "Alice", token: "tok-alice" };
export const BOB: FakeUser = { Id: "b0b00000000000000000000000000001", Name: "Bob", token: "tok-bob" };
export const CAROL: FakeUser = { Id: "ca000000000000000000000000000001", Name: "Carol", token: "tok-carol" };
export const DAVE: FakeUser = { Id: "da000000000000000000000000000001", Name: "Dave", token: "tok-dave" };
export const EVE: FakeUser = { Id: "e0e00000000000000000000000000001", Name: "Eve", token: "tok-eve" };
export const USERS = [ADMIN, ALICE, BOB, CAROL, DAVE, EVE];
export const WITH_DEVICE = [ALICE, BOB, CAROL, DAVE, EVE];

export const SEERR_USERS = USERS.map((u, i) => ({ id: i + 1, jellyfinUserId: u.Id, username: u.Name }));

/** Le jeton Expo de l'appareil d'un compte. */
export const deviceOf = (u: FakeUser): string => `ExponentPushToken[${u.Name.toLowerCase()}]`;

const movie = (id: string, name: string, tmdb: number, year: number): FakeItem => ({
  Id: id,
  Name: name,
  Type: "Movie",
  ProductionYear: year,
  ProviderIds: { Tmdb: String(tmdb) },
});
const series = (id: string, name: string, tmdb: number): FakeItem => ({
  Id: id,
  Name: name,
  Type: "Series",
  ProviderIds: { Tmdb: String(tmdb) },
});
export const episodeOf = (seriesItem: FakeItem, s: number, e: number, name: string): FakeItem => ({
  Id: `${seriesItem.Id}-${s}-${e}`,
  Name: name,
  Type: "Episode",
  SeriesId: seriesItem.Id,
  SeriesName: seriesItem.Name,
  ParentIndexNumber: s,
  IndexNumber: e,
});

export const TMDB = {
  bear: 136315,
  dune: 438631,
  inception: 27205,
  dune2: 693134,
  arrival: 329865,
  interstellar: 157336,
  oppenheimer: 872585,
};

const office = series("series-office", "The Office", 2316);
export const BASELINE: FakeItem[] = [
  movie("item-heat", "Heat", 949, 1995),
  office,
  episodeOf(office, 1, 1, "Pilot"),
  episodeOf(office, 1, 2, "Diversity Day"),
];

export const BEAR = series("series-bear", "The Bear", TMDB.bear);
export const BEAR_EPISODES = ["System", "Hands", "Brigade", "Dogs", "Sheridan"].map((name, i) => episodeOf(BEAR, 1, i + 1, name));

export const DUNE = movie("item-dune", "Dune", TMDB.dune, 2021);
export const DUNE_4K = movie("item-dune-2160p", "Dune", TMDB.dune, 2021);
export const INCEPTION = movie("item-inception", "Inception", TMDB.inception, 2010);
export const DUNE2 = movie("item-dune2", "Dune: Part Two", TMDB.dune2, 2024);
export const ARRIVAL = movie("item-arrival", "Arrival", TMDB.arrival, 2016);
export const ARRIVAL_AGAIN = movie("item-arrival-2", "Arrival", TMDB.arrival, 2016);
export const OPPENHEIMER = movie("item-oppenheimer", "Oppenheimer", TMDB.oppenheimer, 2023);
