/**
 * Les jeux de données du domaine « panneaux-cartes » (T6), appelés par
 * `start.fixtures` : ils retouchent la base du banc (l'instantané figé).
 * Le titre éprouvé est le premier des derniers ajouts de Films tels que le
 * faux backend les sert, « 2001 : L'Odyssée de l'espace » (film, identifiant
 * TMDB connu, jamais noté dans la base).
 */

const FILM = "49ec99b03dd4d7ccb318d78d84a5172c";
/** « GTO - Great Teacher Onizuka » (tv:62057) : la bibliothèque n'en a que la saison 1 ; le faux Vigie
 *  dit les autres (`titles.gaps`, `titles.seasons` — `live-requests/fakeSeasons.mjs`). */
const GTO = "52665ab1c968caf9c32b3ef48f69b3f0";

/** Un résultat de bibliothèque tel que `/api/search` le rend (`SearchItemHit`) : trouvé par son titre. */
const byTitle = (item) => ({ item, match: { field: "title" }, score: 1 });

export default {
  "film-note-7": {
    description: "« 2001 : L'Odyssée de l'espace » (premier des derniers ajouts de Films) noté 7/10",
    apply: (data) => data.rate(FILM, 7),
  },
  "film-non-notable": {
    description: "« 2001 : L'Odyssée de l'espace » sans identifiant TMDB : rien à noter",
    apply: (data) => data.makeUnratable(FILM),
  },
  "recherche-gto": {
    description: "la recherche « GTO » rend la série GTO (saisons manquantes, `titles.gaps`) — réponse complète, `match` compris",
    apply: (data) => {
      // La recherche de la base rend ses résultats sans `match`, que l'écran lit : une réponse entière ici.
      data.route("GET", /^\/api\/search$/, (req, res, { url, json }) => {
        const query = url.searchParams.get("q") ?? "";
        const series = /gto/i.test(query) ? [byTitle(data.item(GTO))] : [];
        json(res, 200, {
          query, ready: true, tookMs: 1, correction: null, partial: false,
          top: series[0] ? { kind: "item", hit: series[0] } : null,
          movies: [], series, collections: [], people: [], genres: [], studios: [],
          totals: { movies: 0, series: series.length, collections: 0, people: 0 },
        });
      });
      data.route("GET", /^\/api\/search\/episodes$/, (req, res, { url, json }) => json(res, 200, { query: url.searchParams.get("q") ?? "", episodes: [] }));
    },
  },
};
