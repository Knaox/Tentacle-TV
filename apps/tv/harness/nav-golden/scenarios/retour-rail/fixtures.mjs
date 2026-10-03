/**
 * Les jeux de données du domaine « retour-rail » (T4), appelés par
 * `start.fixtures` dans `scenarios.json`. Données pures : le banc nav-golden
 * (T2) les pose sur son faux backend et dans le stockage de l'appareil avant
 * chaque scénario, et remplace les `{variables}` des scénarios par `vars`.
 *
 * Un jeu peut s'empiler sur un autre (`["rail.base", "rail.vigie"]`) : les
 * champs du second complètent ou remplacent ceux du premier.
 */

/** Trois bibliothèques dans l'ordre par défaut de `useLibraries()`. */
const LIBRARIES = [
  { Id: "rr-lib-films", Name: "Films", CollectionType: "movies" },
  { Id: "rr-lib-series", Name: "Séries", CollectionType: "tvshows" },
  { Id: "rr-lib-animes", Name: "Animés", CollectionType: "tvshows" },
];

/** Vingt-quatre bibliothèques : la liste du rail défile. */
const LIBRARIES_24 = Array.from({ length: 24 }, (_, index) => ({
  Id: `rr-lib-${String(index).padStart(2, "0")}`,
  Name: `Bibliothèque ${index + 1}`,
  CollectionType: index % 2 === 0 ? "movies" : "tvshows",
}));

export const fixtures = {
  "rail.base": {
    why: "session factice, 3 bibliothèques, rien de masqué ni de déplacé, Vigie absent",
    session: true,
    libraries: LIBRARIES,
    // L'accueil : un héros, et une première rangée d'au moins six cartes (GAUCHE maintenu en traverse quatre).
    home: { hero: true, firstRowMinCards: 6 },
    // La fiche de grid:0 de la première bibliothèque : des similaires qui ont eux-mêmes des similaires, un casting.
    detail: { film: "rr-film-a", similarChain: ["rr-film-b", "rr-film-c"], castPerson: "rr-person-1" },
    series: { series: "rr-series-1", episode: "rr-episode-1" },
    vigie: "off",
    storage: { tentacle_webos_rail: null },
    vars: {
      lib0: LIBRARIES[0].Id,
      lib0Name: LIBRARIES[0].Name,
      lib1: LIBRARIES[1].Id,
      lib2: LIBRARIES[2].Id,
      film: "rr-film-a",
      similar0: "rr-film-b",
      similar0of0: "rr-film-c",
      series: "rr-series-1",
      episode: "rr-episode-1",
      person: "rr-person-1",
      personName: "Personne Un",
      genre: "rr-genre-drame",
      genreName: "Drame",
    },
  },
  "rail.vigie": {
    why: "Vigie à jour (contrat titles), compte autorisé, une demande faite depuis une TV : l'aperçu des demandes paraît au-dessus du profil",
    vigie: "on",
    requests: [{ origin: "tv", title: "rr-request-1", progress: 0.4 }],
  },
  "rail.libraries24": {
    why: "la liste du rail dépasse la hauteur permise et défile",
    session: true,
    libraries: LIBRARIES_24,
    home: { hero: true, firstRowMinCards: 6 },
    vigie: "off",
    storage: { tentacle_webos_rail: null },
    vars: {
      lib20: LIBRARIES_24[20].Id,
      lib20Name: LIBRARIES_24[20].Name,
      lib23: LIBRARIES_24[23].Id,
    },
  },
  "rail.noSession": {
    why: "aucune session : le jumelage à la racine ; un faux serveur répond à la vérification du serveur saisi à la main",
    session: false,
    manualServer: true,
    storage: { tentacle_webos_rail: null },
    vars: { serverUrl: "http://127.0.0.1:3104" },
  },
  "rail.screenError": {
    why: "l'écran de la bibliothèque lève une erreur au rendu (déclencheur provisoire par CDP, retiré après)",
    forceError: { route: "Library" },
  },
  "rail.detailError": {
    why: "la fiche lève une erreur au rendu (déclencheur provisoire par CDP, retiré après)",
    forceError: { route: "MediaDetail" },
  },
  "rail.serverDown": {
    why: "santé du serveur coupée : le bandeau hors ligne paraît après 12 s d'échecs",
    health: "down",
  },
};
