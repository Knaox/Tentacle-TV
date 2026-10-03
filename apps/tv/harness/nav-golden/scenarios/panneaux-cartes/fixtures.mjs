/**
 * Les jeux de données du domaine « panneaux-cartes » (T6), appelés par
 * `start.fixtures` : ils retouchent la base du banc (l'instantané figé).
 * Le titre éprouvé est le premier des derniers ajouts de Films, « The
 * Uprising » (film, identifiant TMDB connu, jamais noté dans la base).
 */

const FILM = "fc152eff617de3f78aeb07db87431ba3";

export default {
  "film-note-7": {
    description: "« The Uprising » (premier des derniers ajouts de Films) noté 7/10",
    apply: (data) => data.rate(FILM, 7),
  },
  "film-non-notable": {
    description: "« The Uprising » sans identifiant TMDB : rien à noter",
    apply: (data) => data.makeUnratable(FILM),
  },
};
