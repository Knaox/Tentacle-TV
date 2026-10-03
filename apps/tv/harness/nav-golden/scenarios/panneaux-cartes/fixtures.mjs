/**
 * Les jeux de données du domaine « panneaux-cartes » (T6), appelés par
 * `start.fixtures` : ils retouchent la base du banc (l'instantané figé).
 * Le titre éprouvé est le premier des derniers ajouts de Films tels que le
 * faux backend les sert, « 2001 : L'Odyssée de l'espace » (film, identifiant
 * TMDB connu, jamais noté dans la base).
 */

const FILM = "49ec99b03dd4d7ccb318d78d84a5172c";

export default {
  "film-note-7": {
    description: "« 2001 : L'Odyssée de l'espace » (premier des derniers ajouts de Films) noté 7/10",
    apply: (data) => data.rate(FILM, 7),
  },
  "film-non-notable": {
    description: "« 2001 : L'Odyssée de l'espace » sans identifiant TMDB : rien à noter",
    apply: (data) => data.makeUnratable(FILM),
  },
};
